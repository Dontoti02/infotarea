import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { studentId, relationship = "padre" } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: "El ID del estudiante es requerido" }, { status: 400 });
    }

    // Verify student exists and has student role
    const { data: student, error: studentErr } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", studentId)
      .eq("role", "student")
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ error: "El estudiante especificado no existe o no tiene rol estudiante" }, { status: 404 });
    }

    // Ensure parent profile exists in public.parents
    const { data: parentRecord } = await supabase
      .from("parents")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!parentRecord) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      await supabase.from("parents").insert({
        profile_id: user.id,
        full_name: profile?.full_name || "Padre de familia",
        relationship: relationship,
      });
    }

    // Insert into parent_children
    const { data: link, error: linkErr } = await supabase
      .from("parent_children")
      .insert({
        parent_profile_id: user.id,
        student_profile_id: studentId,
      })
      .select()
      .single();

    if (linkErr) {
      if (linkErr.code === "23505") { // unique constraint violation
        return NextResponse.json({ message: "El hijo ya está vinculado a esta cuenta", alreadyLinked: true });
      }
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${student.full_name} ha sido vinculado correctamente`,
      link,
    });
  } catch (err: any) {
    console.error("Error linking child:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "El ID del estudiante es requerido" }, { status: 400 });
    }

    const { error } = await supabase
      .from("parent_children")
      .delete()
      .eq("parent_profile_id", user.id)
      .eq("student_profile_id", studentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Hijo desvinculado con éxito" });
  } catch (err: any) {
    console.error("Error unlinking child:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
