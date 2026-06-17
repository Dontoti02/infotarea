import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createClient as createVanillaClient } from '@supabase/supabase-js';

/**
 * DB table `academic_periods` has these columns:
 *   id, year (INT), label (TEXT), closed_by (UUID FK), closed_at,
 *   total_students, total_teachers, total_courses, total_tasks,
 *   total_submissions, total_notices, total_resources,
 *   archived_courses (JSONB), archived_notices (JSONB), archived_resources (JSONB),
 *   created_at
 */

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createVanillaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

async function verifyAdmin() {
  const supabaseServer = await createSSRClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) return { user: null, profile: null };

  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

// ─── POST: Close the current academic year ───────────────────────────────────
export async function POST(request: Request) {
  try {
    const { user, profile } = await verifyAdmin();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

    const { yearLabel, yearNumber } = await request.json() as {
      yearLabel: string;
      yearNumber: number;
    };

    if (!yearLabel || !yearNumber) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const adminClient = getAdminClient();
    if (!adminClient) return NextResponse.json({ error: 'Se requiere SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });

    // Gather statistics
    const [
      { count: totalStudents },
      { count: totalTeachers },
      { count: totalCourses },
      { count: totalTasks },
      { count: totalSubmissions },
      { count: totalNotices },
      { count: totalResources },
    ] = await Promise.all([
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      adminClient.from('courses').select('*', { count: 'exact', head: true }),
      adminClient.from('tasks').select('*', { count: 'exact', head: true }),
      adminClient.from('submissions').select('*', { count: 'exact', head: true }),
      adminClient.from('notices').select('*', { count: 'exact', head: true }),
      adminClient.from('resources').select('*', { count: 'exact', head: true }),
    ]);

    // Archive detailed data
    const { data: coursesData } = await adminClient
      .from('courses')
      .select(`
        id, name, section, image_url, teacher_id, created_at,
        tasks(
          id, title, description, due_date, task_type, created_at,
          submissions(
            id, student_id, content, status, score, feedback, file_url, file_name, created_at
          )
        )
      `);

    const { data: noticesData } = await adminClient
      .from('notices')
      .select('id, title, content, category, created_at, expire_at')
      .order('created_at', { ascending: false });

    const { data: resourcesData } = await adminClient
      .from('resources')
      .select('id, name, file_type, file_url, file_size, created_at, course_id')
      .order('created_at', { ascending: false });

    // Insert academic period record (using actual DB column names: year, label)
    const { data: periodData, error: insertError } = await adminClient
      .from('academic_periods')
      .insert({
        year: yearNumber,
        label: yearLabel,
        closed_by: user.id,
        total_students: totalStudents ?? 0,
        total_teachers: totalTeachers ?? 0,
        total_courses: totalCourses ?? 0,
        total_tasks: totalTasks ?? 0,
        total_submissions: totalSubmissions ?? 0,
        total_notices: totalNotices ?? 0,
        total_resources: totalResources ?? 0,
        archived_courses: coursesData ?? [],
        archived_notices: noticesData ?? [],
        archived_resources: resourcesData ?? [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('[close-year] Error archiving period:', insertError);
      return NextResponse.json({ error: 'Error al archivar: ' + insertError.message }, { status: 500 });
    }

    // Clear operational tables (order matters for FK constraints)
    await adminClient.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await adminClient.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await adminClient.from('notices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await adminClient.from('resources').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await adminClient.from('course_members').delete().neq('course_id', '00000000-0000-0000-0000-000000000000');

    console.log(`[close-year] Year closed: ${yearLabel} by ${profile.full_name}`);

    return NextResponse.json({
      success: true,
      period: {
        id: periodData.id,
        label: periodData.label,
        closedAt: periodData.closed_at,
        stats: {
          students: totalStudents ?? 0,
          teachers: totalTeachers ?? 0,
          courses: totalCourses ?? 0,
          tasks: totalTasks ?? 0,
          submissions: totalSubmissions ?? 0,
          notices: totalNotices ?? 0,
          resources: totalResources ?? 0,
        }
      }
    });
  } catch (err: any) {
    console.error('[close-year] Internal error:', err);
    return NextResponse.json({ error: 'Error interno: ' + err.message }, { status: 500 });
  }
}

// ─── GET: Fetch academic periods history + current stats ─────────────────────
export async function GET() {
  try {
    const { user, profile } = await verifyAdmin();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

    const adminClient = getAdminClient();
    if (!adminClient) return NextResponse.json({ error: 'Se requiere SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });

    // Fetch periods (using actual DB columns: year, label)
    const { data: periods, error } = await adminClient
      .from('academic_periods')
      .select(`
        id, year, label, closed_at, closed_by,
        total_students, total_teachers, total_courses,
        total_tasks, total_submissions, total_notices, total_resources
      `)
      .order('closed_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Resolve admin names
    const closedByIds = [...new Set((periods ?? []).map(p => p.closed_by).filter(Boolean))];
    let adminNames: Record<string, string> = {};
    if (closedByIds.length > 0) {
      const { data: admins } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .in('id', closedByIds);
      if (admins) {
        adminNames = Object.fromEntries(admins.map(a => [a.id, a.full_name]));
      }
    }

    const periodsWithNames = (periods ?? []).map(p => ({
      ...p,
      closed_by_name: adminNames[p.closed_by] || 'Admin',
    }));

    // Current year stats
    const [
      { count: currentStudents },
      { count: currentTeachers },
      { count: currentCourses },
      { count: currentTasks },
      { count: currentSubmissions },
      { count: currentNotices },
      { count: currentResources },
    ] = await Promise.all([
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      adminClient.from('courses').select('*', { count: 'exact', head: true }),
      adminClient.from('tasks').select('*', { count: 'exact', head: true }),
      adminClient.from('submissions').select('*', { count: 'exact', head: true }),
      adminClient.from('notices').select('*', { count: 'exact', head: true }),
      adminClient.from('resources').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      periods: periodsWithNames,
      currentStats: {
        students: currentStudents ?? 0,
        teachers: currentTeachers ?? 0,
        courses: currentCourses ?? 0,
        tasks: currentTasks ?? 0,
        submissions: currentSubmissions ?? 0,
        notices: currentNotices ?? 0,
        resources: currentResources ?? 0,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno: ' + err.message }, { status: 500 });
  }
}
