import { NextResponse } from 'next/server';
import { createClient as createVanillaClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { 
      email, 
      password, 
      fullName, 
      phone = '', 
      relationship = 'padre' 
    } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (nombre, correo y contraseña)' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
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
        user_metadata: { full_name: fullName, role: 'parent', phone, relationship }
      });
      createdUser = adminData?.user || null;
      creationError = adminError;
    }

    // Direct PostgreSQL creation fallback to guarantee 100% reliable creation
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
          [email, hashedPassword, JSON.stringify({ full_name: fullName, role: 'parent', phone, relationship })]
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

          // Also ensure profile exists in profiles table
          await client.query(
            `INSERT INTO public.profiles (id, full_name, role, email)
             VALUES ($1, $2, 'parent', $3)
             ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'parent'`,
            [newId, fullName, newEmail]
          );

          // Insert into parents table
          await client.query(
            `INSERT INTO public.parents (profile_id, full_name, phone, relationship)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [newId, fullName, phone, relationship]
          );
        }
        await client.end();
      } catch (dbErr: any) {
        console.error('Parent direct DB creation error:', dbErr);
        creationError = dbErr;
      }
    }

    if (creationError || !createdUser) {
      return NextResponse.json({ error: creationError?.message || 'Error al registrar la cuenta de padre' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      user: createdUser,
      message: 'Cuenta de padre de familia creada exitosamente' 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
