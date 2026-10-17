import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { childAcademicInfo, verifiedChildIds, queryFamilyLinks, FAMILY_VERIFICATION_NOTICE, type FamilyLink } from "@/shared/utils/communication";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "parent") return NextResponse.json({ error: "Acceso exclusivo para padres" }, { status: 403 });

    // 1. Get linked student profile IDs
    const { data: links, error: linkErr, verificationAvailable } = await queryFamilyLinks<FamilyLink[]>(includeVerification => {
      const query = supabase.from("parent_children");
      return includeVerification
        ? query.select("id, student_profile_id, linked_at, verified_at").eq("parent_profile_id", user.id)
        : query.select("id, student_profile_id, linked_at").eq("parent_profile_id", user.id);
    });
    const notice = verificationAvailable ? undefined : FAMILY_VERIFICATION_NOTICE;

    if (linkErr) {
      console.error("Error fetching parent_children:", linkErr);
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    if (!links || links.length === 0) {
      return NextResponse.json({ children: [], verificationAvailable, notice }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const studentIds = links.map((l) => l.student_profile_id);
    const verifiedIds = new Set(verificationAvailable ? verifiedChildIds(links) : []);

    // 2. Fetch full student profiles
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        avatar_url,
        course_members (
          course_id,
          courses (
            id,
            name,
            section,
            image_url,
            teacher_id,
            teacher:teacher_id (
              id,
              full_name,
              email
            )
          )
        )
      `)
      .in("id", studentIds).eq("role", "student");

    if (profErr) {
      console.error("Error fetching student profiles:", profErr);
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    // 3. Fetch submissions/grades for these students
    const { data: submissions, error: submissionsError } = verifiedIds.size ? await supabase
      .from("submissions")
      .select(`
        id,
        task_id,
        student_id,
        status,
        score,
        feedback,
        created_at,
        tasks (
          id,
          title,
          task_type,
          due_date,
          course_id,
          courses:course_id (
            name,
            section
          )
        )
      `)
      .in("student_id", Array.from(verifiedIds))
      .order("created_at", { ascending: false }) : { data: [], error: null };

    if (submissionsError) return NextResponse.json({ error: "No se pudo consultar el seguimiento del estudiante" }, { status: 503 });

    // 4. Also fetch active tasks for their enrolled courses
    const allCourseIds = new Set<string>();
    (profiles || []).forEach((p: any) => {
      if (!verifiedIds.has(p.id)) return;
      (p.course_members || []).forEach((cm: any) => {
        if (cm.courses?.id) allCourseIds.add(cm.courses.id);
      });
    });

    let courseTasks: any[] = [];
    if (allCourseIds.size > 0) {
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          due_date,
          task_type,
          course_id,
          courses:course_id (
            name,
            section
          )
        `)
        .in("course_id", Array.from(allCourseIds))
        .order("due_date", { ascending: false });
      if (tasksError) return NextResponse.json({ error: "No se pudieron consultar las tareas" }, { status: 503 });
      courseTasks = tasksData || [];
    }

    // 5. Build rich children objects
    const children = (profiles || []).map((prof: any) => {
      const verificationPending = !verifiedIds.has(prof.id);
      const academic = childAcademicInfo(verificationPending ? { course_members: [] } : prof);
      const { courses, section, teachers } = academic;

      const studentSubs = (submissions || []).filter((s: any) => s.student_id === prof.id);

      // Calculate stats
      const evaluatedSubs = studentSubs.filter((s: any) => s.score !== null && s.score !== undefined);
      const averageScore = evaluatedSubs.length > 0
        ? Number((evaluatedSubs.reduce((acc: number, s: any) => acc + Number(s.score), 0) / evaluatedSubs.length).toFixed(1))
        : null;

      const highestScore = evaluatedSubs.length > 0
        ? Math.max(...evaluatedSubs.map((s: any) => Number(s.score)))
        : null;

      // Find pending tasks for this student
      const submittedTaskIds = new Set(studentSubs.map((s: any) => s.task_id));
      const myCourseIds = new Set(courses.map((c: any) => c.id));
      const pendingTasks = courseTasks
        .filter((t: any) => myCourseIds.has(t.course_id) && !submittedTaskIds.has(t.id));

      return {
        id: prof.id,
        full_name: prof.full_name,
        email: prof.email,
        avatar_url: prof.avatar_url,
        section,
        courses,
        teachers,
        grade: academic.grade,
        classrooms: academic.classrooms,
        classroomLabel: !verificationAvailable ? "Verificación familiar pendiente de activación" : verificationPending ? "Vínculo pendiente de verificación" : academic.classroomLabel,
        verificationPending,
        stats: {
          averageScore,
          highestScore,
          totalSubmissions: studentSubs.length,
          pendingTasksCount: pendingTasks.length,
          coursesCount: courses.length,
        },
        submissions: studentSubs,
        pendingTasks,
      };
    });

    return NextResponse.json({ children, verificationAvailable, notice }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: any) {
    console.error("Error in children endpoint:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
