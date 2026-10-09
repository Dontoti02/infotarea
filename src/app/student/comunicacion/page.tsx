import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { CommunicationHub } from "@/shared/components/communication/CommunicationHub";
import { createClient } from "@/lib/supabase/server";

export default async function StudentCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let studentName = "Estudiante";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile?.full_name) {
      studentName = profile.full_name;
    }
  }

  return (
    <StudentLayout>
      <CommunicationHub 
        userRole="student"
        userId={user?.id}
        userName={studentName}
        defaultTab="teacher_student"
      />
    </StudentLayout>
  );
}

