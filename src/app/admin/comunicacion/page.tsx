import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { CommunicationHub } from "@/shared/components/communication/CommunicationHub";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let adminName = "Administrador";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile?.full_name) {
      adminName = profile.full_name;
    }
  }

  return (
    <AdminLayout>
      <CommunicationHub 
        userRole="admin"
        userId={user?.id}
        userName={adminName}
        defaultTab="admin_teacher"
      />
    </AdminLayout>
  );
}

