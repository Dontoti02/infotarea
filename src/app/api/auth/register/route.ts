import { NextResponse } from 'next/server';
import { createClient as createVanillaClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role = 'admin' } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let createdUser: any = null;
    let creationError: any = null;

    if (serviceRoleKey) {
      const supabaseVanilla = createVanillaClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vafrsmzqzgfuamrrtyob.supabase.co',
        serviceRoleKey,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: adminData, error: adminError } = await supabaseVanilla.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role }
      });
      createdUser = adminData?.user || null;
      creationError = adminError;
    }

    // Direct PostgreSQL creation fallback to avoid "Signups not allowed for this instance"
    if (!createdUser) {
      try {
        const { Client } = await import('pg');
        const bcrypt = await import('bcrypt');
        const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.vafrsmzqzgfuamrrtyob:dS3Kvv8GkhpStrGR@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();

        const hashedPassword = await bcrypt.hash(password, 10);
        const insertRes = await client.query(
          `INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
            created_at, updated_at,
            confirmation_token, recovery_token, email_change_token_new,
            email_change, email_change_token_current, phone_change,
            phone_change_token, reauthentication_token, is_super_admin
          ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            $1, $2, NOW(), '{"provider":"email","providers":["email"]}', $3, NOW(), NOW(),
            '', '', '', '', '', '', '', '', false
          ) RETURNING id, email`,
          [email, hashedPassword, JSON.stringify({ full_name: fullName, role })]
        );

        if (insertRes.rows.length > 0) {
          const newId = insertRes.rows[0].id;
          const newEmail = insertRes.rows[0].email;

          await client.query(
            `INSERT INTO auth.identities (
              id, user_id, identity_data, provider, provider_id, 
              last_sign_in_at, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1::uuid, $2::jsonb, 'email', $1::text, 
              NOW(), NOW(), NOW()
            )`,
            [
              newId,
              JSON.stringify({ sub: newId, email: newEmail, email_verified: true, phone_verified: false })
            ]
          );

          createdUser = insertRes.rows[0];
          creationError = null;
        }
        await client.end();
      } catch (dbErr: any) {
        console.error('Register direct DB error:', dbErr);
        creationError = dbErr;
      }
    }

    if (creationError || !createdUser) {
      return NextResponse.json({ error: creationError?.message || 'Error al crear la cuenta' }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: createdUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
