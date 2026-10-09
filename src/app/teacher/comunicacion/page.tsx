import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { CommunicationHub } from "@/shared/components/communication/CommunicationHub";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let teacherName = "Docente";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile?.full_name) {
      teacherName = profile.full_name;
    }
  }

  return (
    <TeacherLayout>
      <CommunicationHub 
        userRole="teacher"
        userId={user?.id}
        userName={teacherName}
        defaultTab="teacher_student"
      />
    </TeacherLayout>
  );
}

