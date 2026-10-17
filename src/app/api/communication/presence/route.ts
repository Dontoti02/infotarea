import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activePresenceIds, isUuid, PRESENCE_TTL_MS } from "@/shared/utils/communication";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data, error } = await supabase.from("communication_presence")
    .select("user_id,last_seen")
    .gt("last_seen", new Date(Date.now() - PRESENCE_TTL_MS).toISOString());
  if (error) return NextResponse.json({ error: "No se pudo consultar la presencia" }, { status: 503 });
  return NextResponse.json({ onlineIds: activePresenceIds(data || []), sessions: data || [], serverTime: Date.now() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function updatePresence(request: Request, remove: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.sessionId)) return NextResponse.json({ error: "Sesión inválida" }, { status: 400 });
  const query = remove
    ? supabase.from("communication_presence").delete().eq("user_id", user.id).eq("session_id", body.sessionId)
    : supabase.from("communication_presence").upsert({ user_id: user.id, session_id: body.sessionId }, { onConflict: "user_id,session_id" });
  const { error } = await query;
  if (error) return NextResponse.json({ error: "No se pudo actualizar la presencia" }, { status: 503 });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) { return updatePresence(request, false); }
export async function DELETE(request: Request) { return updatePresence(request, true); }
