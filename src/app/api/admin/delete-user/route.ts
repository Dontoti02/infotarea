import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createClient as createVanillaClient } from '@supabase/supabase-js';

export async function DELETE(request: Request) {
  try {
    // 1. Verify admin
    const supabaseServer = await createSSRClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[delete-user] auth uid:', user.id, '| profile:', profile, '| profileError:', profileError?.message);

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: `Acceso denegado (rol: ${profile?.role ?? 'null'})` }, { status: 403 });
    }

    // 2. Get user IDs to delete
    const { ids } = await request.json() as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron IDs' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Se requiere SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const adminClient = createVanillaClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 3. Delete from auth.users (profiles cascade automatically)
    const results = await Promise.all(
      ids.map(async (id) => {
        const { error } = await adminClient.auth.admin.deleteUser(id);
        return { id, success: !error, error: error?.message };
      })
    );

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.error('Some users failed to delete from auth:', failed);
    }

    return NextResponse.json({
      deleted: results.filter(r => r.success).length,
      failed: failed.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno: ' + err.message }, { status: 500 });
  }
}
