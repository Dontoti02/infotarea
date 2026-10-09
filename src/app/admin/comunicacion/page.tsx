import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { CommunicationHub } from "@/shared/components/communication/CommunicationHub";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let adminName = "Administrador";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  if (profile?.full_name) adminName = profile.full_name;

  return (
    <AdminLayout>
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Comunicación</h1>
        <p className="text-sm text-on-surface-variant">Chat directo con los docentes de la institución</p>
      </div>
      <CommunicationHub
        userRole="admin"
        userId={user.id}
        userName={adminName}
      />
    </AdminLayout>
  );
}
