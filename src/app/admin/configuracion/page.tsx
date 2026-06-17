import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { ProfileSettings } from "@/shared/components/ProfileSettings";
import { CreateAdminForm } from "@/modules/admin/components/CreateAdminForm";

export default function AdminSettingsPage() {
  return (
    <AdminLayout>
      <ProfileSettings extraCuentaContent={<CreateAdminForm />} />
    </AdminLayout>
  );
}
