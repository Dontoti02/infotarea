import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { CommunicationHub } from "@/shared/components/communication/CommunicationHub";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StudentCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let studentName = "Estudiante";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (profile?.full_name) {
    studentName = profile.full_name;
  }

  return (
    <StudentLayout>
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Comunicación</h1>
        <p className="text-sm text-on-surface-variant">
          Chat directo con los docentes asignados a tus cursos
        </p>
      </div>
      <CommunicationHub 
        userRole="student"
        userId={user.id}
        userName={studentName}
      />
    </StudentLayout>
  );
}
