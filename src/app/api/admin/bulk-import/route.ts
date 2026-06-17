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

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Se requiere SUPABASE_SERVICE_ROLE_KEY en .env.local para la importación masiva.' },
        { status: 503 }
      );
    }

    // 3. Build admin client (bypasses ALL rate limits + RLS)
    const adminClient = createVanillaClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
