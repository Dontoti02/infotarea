import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { CommunicationHub } from "@/shared/components/communication/CommunicationHub";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TeacherCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let teacherName = "Docente";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  if (profile?.full_name) teacherName = profile.full_name;

  return (
    <TeacherLayout>
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Comunicación</h1>
        <p className="text-sm text-on-surface-variant">
          Chat con tus alumnos, la dirección y los padres de familia
        </p>
      </div>
      <CommunicationHub
        userRole="teacher"
        userId={user.id}
        userName={teacherName}
      />
    </TeacherLayout>
  );
}
