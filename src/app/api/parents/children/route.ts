import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1. Get linked student profile IDs
    const { data: links, error: linkErr } = await supabase
      .from("parent_children")
      .select("id, student_profile_id, linked_at")
      .eq("parent_profile_id", user.id);

    if (linkErr) {
      console.error("Error fetching parent_children:", linkErr);
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    if (!links || links.length === 0) {
      return NextResponse.json({ children: [] });
    }

    const studentIds = links.map((l) => l.student_profile_id);

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
      .in("id", studentIds);

    if (profErr) {
      console.error("Error fetching student profiles:", profErr);
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    // 3. Fetch submissions/grades for these students
    const { data: submissions } = await supabase
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
      .in("student_id", studentIds)
      .order("created_at", { ascending: false });

    // 4. Also fetch active tasks for their enrolled courses
    const allCourseIds = new Set<string>();
    (profiles || []).forEach((p: any) => {
      (p.course_members || []).forEach((cm: any) => {
        if (cm.courses?.id) allCourseIds.add(cm.courses.id);
      });
    });

    let courseTasks: any[] = [];
    if (allCourseIds.size > 0) {
      const { data: tasksData } = await supabase
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
      courseTasks = tasksData || [];
    }

    // 5. Build rich children objects
    const children = (profiles || []).map((prof: any) => {
      const courses = (prof.course_members || [])
        .map((cm: any) => cm.courses)
        .filter(Boolean);

      const studentSubs = (submissions || []).filter((s: any) => s.student_id === prof.id);

      // Calculate stats
      const evaluatedSubs = studentSubs.filter((s: any) => s.score !== null && s.score !== undefined);
      const averageScore = evaluatedSubs.length > 0
        ? Number((evaluatedSubs.reduce((acc: number, s: any) => acc + Number(s.score), 0) / evaluatedSubs.length).toFixed(1))
        : null;

      const highestScore = evaluatedSubs.length > 0
        ? Math.max(...evaluatedSubs.map((s: any) => Number(s.score)))
        : null;

      // Primary section/grade
      const primaryCourse = courses[0];
      const section = primaryCourse?.section || "1A";

      // Teachers of courses
      const teachers = courses
        .filter((c: any) => c.teacher)
        .map((c: any) => ({
          courseName: c.name,
          section: c.section,
          id: c.teacher.id,
          full_name: c.teacher.full_name,
          email: c.teacher.email,
        }));

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

    return NextResponse.json({ children });
  } catch (err: any) {
    console.error("Error in children endpoint:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
