import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createClient as createVanillaClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. Verify caller is an admin
    const supabaseServer = await createSSRClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // 2. Parse the batch
    const { students } = await request.json() as {
      students: Array<{
        fullName: string;
        email: string;
        password: string;
        section: string;
        originalName: string;
      }>;
    };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No se recibieron estudiantes' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Fallback a conexión directa PostgreSQL cuando SUPABASE_SERVICE_ROLE_KEY no está configurada
    if (!serviceRoleKey) {
      const { Client } = await import('pg');
      const bcrypt = await import('bcrypt');
      const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.vafrsmzqzgfuamrrtyob:dS3Kvv8GkhpStrGR@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
      const pgClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await pgClient.connect();

      try {
        // Pre-cargar cursos existentes agrupados por sección
        const coursesRes = await pgClient.query('SELECT id, section FROM public.courses');
        const courseBySection = new Map<string, string>(
          coursesRes.rows.map((c: any) => [c.section as string, c.id as string])
        );

        const ensureCourse = async (section: string): Promise<string | null> => {
          const existing = courseBySection.get(section);
          if (existing) return existing;

          const ins = await pgClient.query(
            'INSERT INTO public.courses (name, section) VALUES ($1, $2) RETURNING id',
            [`Aula ${section}`, section]
          );
          if (ins.rows.length > 0) {
            const newId = ins.rows[0].id;
            courseBySection.set(section, newId);
            return newId;
          }
          return null;
        };

        const results = [];
        for (const student of students) {
          try {
            const trimmedEmail = student.email.trim().toLowerCase();
            const trimmedName = student.fullName.trim();
            const trimmedSection = (student.section || '').trim().toUpperCase();

            // Verificar si el usuario ya existe en auth.users
            const userCheck = await pgClient.query(
              'SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1',
              [trimmedEmail]
            );

            let userId: string;
            let isReactivation = false;
            const hashedPassword = await bcrypt.hash(student.password, 10);

            if (userCheck.rows.length > 0) {
              userId = userCheck.rows[0].id;
              isReactivation = true;
              await pgClient.query(
                `UPDATE auth.users 
                 SET encrypted_password = $1, 
                     raw_user_meta_data = $2, 
                     updated_at = NOW() 
                 WHERE id = $3`,
                [hashedPassword, JSON.stringify({ full_name: trimmedName, role: 'student' }), userId]
              );
            } else {
              const insertUser = await pgClient.query(
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
                ) RETURNING id`,
                [trimmedEmail, hashedPassword, JSON.stringify({ full_name: trimmedName, role: 'student' })]
              );
              userId = insertUser.rows[0].id;

              await pgClient.query(
                `INSERT INTO auth.identities (
                  id, user_id, identity_data, provider, provider_id, 
                  last_sign_in_at, created_at, updated_at
                ) VALUES (
                  gen_random_uuid(), $1::uuid, $2::jsonb, 'email', $1::text, 
                  NOW(), NOW(), NOW()
                )
                ON CONFLICT (provider_id, provider) DO UPDATE 
                SET identity_data = EXCLUDED.identity_data, updated_at = NOW()`,
                [
                  userId,
                  JSON.stringify({ sub: userId, email: trimmedEmail, email_verified: true, phone_verified: false })
                ]
              );
            }

            // Asegurar perfil en public.profiles
            await pgClient.query(
              `INSERT INTO public.profiles (id, full_name, role)
               VALUES ($1, $2, 'student')
               ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'student'`,
              [userId, trimmedName]
            );

            // Guardar credenciales temporales
            await pgClient.query(
              `INSERT INTO public.temp_credentials (profile_id, email, temp_password)
               VALUES ($1, $2, $3)
               ON CONFLICT (profile_id) DO UPDATE 
               SET email = EXCLUDED.email, temp_password = EXCLUDED.temp_password`,
              [userId, trimmedEmail, student.password]
            );

            // Matricular en curso/sección
            if (trimmedSection) {
              const courseId = await ensureCourse(trimmedSection);
              if (courseId) {
                await pgClient.query(
                  `INSERT INTO public.course_members (course_id, profile_id)
                   VALUES ($1, $2)
                   ON CONFLICT (course_id, profile_id) DO NOTHING`,
                  [courseId, userId]
                );
              }
            }

            results.push({ ...student, status: 'success', reactivated: isReactivation });
          } catch (stErr: any) {
            results.push({ ...student, status: 'error', errorMessage: stErr.message ?? 'Error inesperado' });
          }
        }

        const successCount = results.filter((r) => r.status === 'success').length;
        const errorCount = results.filter((r) => r.status === 'error').length;

        return NextResponse.json({ results, successCount, errorCount });
      } finally {
        await pgClient.end();
      }
    }

    // 3. Build admin client (bypasses ALL rate limits + RLS cuando serviceRoleKey está presente)
    const adminClient = createVanillaClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vafrsmzqzgfuamrrtyob.supabase.co',
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 4. Pre-load existing courses grouped by section
    const { data: existingCourses } = await adminClient
      .from('courses')
      .select('id, section');

    const courseBySection = new Map<string, string>(
      (existingCourses ?? []).map((c: any) => [c.section as string, c.id as string])
    );

    // Helper: ensure course exists for section and return its ID
    const ensureCourse = async (section: string): Promise<string | null> => {
      const existing = courseBySection.get(section);
      if (existing) return existing;

      const { data: newCourse } = await adminClient
        .from('courses')
        .insert({ name: `Aula ${section}`, section })
        .select('id')
        .single();

      if (newCourse?.id) {
        courseBySection.set(section, newCourse.id);
        return newCourse.id;
      }
      return null;
    };

    // Helper: enroll student in course (upsert safe)
    const enrollInCourse = async (profileId: string, section: string) => {
      const courseId = await ensureCourse(section);
      if (!courseId) return;
      // upsert so re-importing doesn't fail on duplicate primary key
      await adminClient
        .from('course_members')
        .upsert({ course_id: courseId, profile_id: profileId }, { onConflict: 'course_id,profile_id' });
    };

    // Helper: ensure profile row exists (trigger may have missed it on reactivation)
    const ensureProfile = async (userId: string, fullName: string) => {
      const { data: existing } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!existing) {
        await adminClient.from('profiles').insert({
          id: userId,
          full_name: fullName,
          role: 'student',
        });
      }
    };

    // Helper: upsert temp_credentials
    const upsertCredentials = async (profileId: string, email: string, password: string) => {
      await adminClient
        .from('temp_credentials')
        .upsert({ profile_id: profileId, email, temp_password: password }, { onConflict: 'profile_id' });
    };

    // 5. Process ALL students in parallel
    const results = await Promise.all(
      students.map(async (student) => {
        try {
          // 5a. Try to create auth user
          const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
            email: student.email,
            password: student.password,
            email_confirm: true,
            user_metadata: { full_name: student.fullName, role: 'student' },
          });

          let userId: string | null = null;
          let isReactivation = false;

          if (authErr || !authData?.user) {
            const isDuplicate =
              authErr?.message?.toLowerCase().includes('already registered') ||
              authErr?.message?.toLowerCase().includes('already exists') ||
              authErr?.message?.toLowerCase().includes('email address') ||
              authErr?.status === 422;

            if (!isDuplicate) {
              return { ...student, status: 'error', errorMessage: authErr?.message ?? 'Error desconocido' };
            }

            // Auth user already exists — look them up by email using admin API
            const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
            const existingAuthUser = listData?.users?.find(u => u.email === student.email);

            if (!existingAuthUser) {
              return { ...student, status: 'error', errorMessage: 'Usuario duplicado pero no encontrado en Auth' };
            }

            userId = existingAuthUser.id;
            isReactivation = true;

            // Update password and metadata so credentials are current
            await adminClient.auth.admin.updateUserById(userId, {
              password: student.password,
              user_metadata: { full_name: student.fullName, role: 'student' },
            });
          } else {
            userId = authData.user.id;
          }

          // 5b. Ensure profile row exists (may have been deleted without deleting auth user)
          await ensureProfile(userId, student.fullName);

          // 5c. Upsert credentials
          await upsertCredentials(userId, student.email, student.password);

          // 5d. Enroll in course section
          if (student.section) {
            await enrollInCourse(userId, student.section);
          }

          return { ...student, status: 'success', reactivated: isReactivation };
        } catch (err: any) {
          return { ...student, status: 'error', errorMessage: err.message ?? 'Error inesperado' };
        }
      })
    );

    const successCount = results.filter((r) => r.status === 'success').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({ results, successCount, errorCount });
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno: ' + err.message }, { status: 500 });
  }
}
