import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid, parseHistoryCursor, validatedMessageContent } from "@/shared/utils/communication";

const channels = new Set(["teacher_student", "teacher_parent", "admin_teacher", "student_parent"]);
const failure = (error: { code?: string }) => NextResponse.json({
  error: error.code === "42501" ? "No tienes permiso para realizar esta acción" : "No se pudo guardar o consultar el mensaje",
}, { status: error.code === "42501" ? 403 : 503 });

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const channelType = params.get("channel_type") || "teacher_student";
  const otherUserId = params.get("other_user_id");
  const before = params.get("before_created_at");
  const beforeId = params.get("before_id");
  if (!channels.has(channelType) || (otherUserId !== null && !isUuid(otherUserId))) {
    return NextResponse.json({ error: "Conversación inválida" }, { status: 400 });
  }
  const cursor = parseHistoryCursor(before, beforeId);
  if ((before !== null || beforeId !== null) && !cursor) {
    return NextResponse.json({ error: "Página inválida" }, { status: 400 });
  }
  const participants = otherUserId
    ? `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    : `sender_id.eq.${user.id},receiver_id.eq.${user.id}`;
  // Both cursor parts are validated before constructing the PostgREST filter.
  const filter = cursor
    ? `and(or(${participants}),or(created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})))`
    : participants;
  const query = supabase.from("communication_messages").select("*")
    .eq("channel_type", channelType).or(filter)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(101);
  const { data, error } = await query;
  if (error) return failure(error);
  const messages = (data || []).slice(0, 100).reverse();
  const oldest = messages[0];
  return NextResponse.json({ messages, hasMore: (data || []).length > 100, nextCursor: oldest ? { createdAt: oldest.created_at, id: oldest.id } : null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const content = validatedMessageContent(body?.content);
  if (!content || !isUuid(body?.receiverId) || !channels.has(body?.channelType) || body.receiverId === user.id || (body.messageId !== undefined && !isUuid(body.messageId))) {
    return NextResponse.json({ error: "Elige un destinatario válido y escribe entre 1 y 4000 caracteres" }, { status: 400 });
  }
  const { data, error } = await supabase.from("communication_messages").insert({
    ...(body.messageId ? { id: body.messageId } : {}),
    sender_id: user.id, receiver_id: body.receiverId, channel_type: body.channelType, content, is_read: false,
  }).select("*").single();
  if (error?.code === "23505" && body.messageId) {
    const { data: saved, error: retryError } = await supabase.from("communication_messages").select("*")
      .eq("id", body.messageId).eq("sender_id", user.id).eq("receiver_id", body.receiverId)
      .eq("channel_type", body.channelType).eq("content", content).maybeSingle();
    if (saved && !retryError) return NextResponse.json({ message: saved });
  }
  if (error) return failure(error);
  return NextResponse.json({ message: data }, { status: 201 });
}

async function mutateOwnMessage(request: Request, remove: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const content = validatedMessageContent(body?.content);
  if (!isUuid(body?.id) || (!remove && !content)) {
    return NextResponse.json({ error: "Mensaje inválido: el contenido debe tener entre 1 y 4000 caracteres" }, { status: 400 });
  }
  const query = remove
    ? supabase.from("communication_messages").delete()
    : supabase.from("communication_messages").update({ content });
  const { data, error } = await query.eq("id", body.id).eq("sender_id", user.id).select("*").maybeSingle();
  if (error) return failure(error);
  if (!data) return NextResponse.json({ error: "No existe el mensaje o no te pertenece" }, { status: 404 });
  return NextResponse.json(remove ? { deletedId: data.id } : { message: data });
}

export async function PATCH(request: Request) { return mutateOwnMessage(request, false); }
export async function DELETE(request: Request) { return mutateOwnMessage(request, true); }
