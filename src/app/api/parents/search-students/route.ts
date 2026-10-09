import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nameQuery = (searchParams.get("name") || "").trim().toLowerCase();
    const gradeFilter = (searchParams.get("grade") || "").trim().toLowerCase();
    const sectionFilter = (searchParams.get("section") || "").trim().toUpperCase();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Query students
    let query = supabase
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
            section
          )
        )
      `)
      .eq("role", "student");

    if (nameQuery) {
      query = query.ilike("full_name", `%${nameQuery}%`);
    }

    const { data: students, error } = await query.limit(50);

    if (error) {
      console.error("Error searching students:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process and filter by grade/section
    const results = (students || [])
      .map((st: any) => {
        // Collect courses and sections
        const memberships = st.course_members || [];
        const courses = memberships
          .map((m: any) => m.courses)
          .filter(Boolean);

        const primaryCourse = courses[0] || null;
        const section = primaryCourse?.section || "Sin sección";
        const courseName = primaryCourse?.name || "Sin curso";

        // Try extracting grade from section (e.g. '1A' -> '1', 'Secundaria 2B' -> '2')
        let detectedGrade = "";
        const match = section.match(/(\d+)/);
        if (match) {
          detectedGrade = match[1];
        }

        return {
          id: st.id,
          full_name: st.full_name,
          email: st.email,
          avatar_url: st.avatar_url,
          section: section,
          course_name: courseName,
          courses_count: courses.length,
          courses: courses.map((c: any) => ({ id: c.id, name: c.name, section: c.section })),
          detectedGrade,
        };
      })
      .filter((st) => {
        // Apply grade filter if specified
        if (gradeFilter && gradeFilter !== "all" && gradeFilter !== "todos") {
          // Normalize e.g. "1ro" -> "1", "1°" -> "1"
          const cleanGrade = gradeFilter.replace(/\D/g, "");
          if (cleanGrade && st.detectedGrade && !st.detectedGrade.includes(cleanGrade) && !st.section.toLowerCase().includes(gradeFilter)) {
            return false;
          }
        }

        // Apply section filter if specified
        if (sectionFilter && sectionFilter !== "ALL" && sectionFilter !== "TODAS") {
          // Check if student's section contains this letter
          const letterMatch = st.section.toUpperCase().includes(sectionFilter);
          if (!letterMatch) {
            return false;
          }
        }

        return true;
      });

    return NextResponse.json({ students: results });
  } catch (err: any) {
    console.error("Error in search-students route:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
