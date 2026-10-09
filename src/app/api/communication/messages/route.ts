import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase/server';

// GET /api/communication/messages?channel_type=...&other_user_id=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelType = searchParams.get('channel_type') || 'teacher_student';
    const otherUserId = searchParams.get('other_user_id');

    const supabase = await createSSRClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let query = supabase
      .from('communication_messages')
      .select('*, sender:sender_id(id, full_name, role, avatar_url), receiver:receiver_id(id, full_name, role, avatar_url)')
      .eq('channel_type', channelType)
      .order('created_at', { ascending: true });

    if (otherUserId) {
      query = query.or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      );
    } else {
      query = query.or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: true, messages: [], notice: 'Tabla no disponible' });
    }

    return NextResponse.json({ success: true, messages: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/communication/messages
export async function POST(request: Request) {
  try {
    const supabase = await createSSRClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, channelType, content, courseId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }
    if (!channelType) {
      return NextResponse.json({ error: 'Tipo de canal requerido' }, { status: 400 });
    }

    const messageData: any = {
      sender_id: user.id,
      receiver_id: receiverId || null,
      channel_type: channelType,
      content: content.trim(),
      is_read: false,
    };

    if (courseId) messageData.course_id = courseId;

    const { data, error } = await supabase
      .from('communication_messages')
      .insert(messageData)
      .select('*, sender:sender_id(id, full_name, role), receiver:receiver_id(id, full_name, role)')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
