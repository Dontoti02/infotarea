import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { ProfileSettings } from "@/shared/components/ProfileSettings";
import { CreateAdminForm } from "@/modules/admin/components/CreateAdminForm";
import { EmailSettingsPanel } from "@/modules/smart";

export default function AdminSettingsPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-xl">
        <ProfileSettings extraCuentaContent={<CreateAdminForm />} />

        {/* 23. Servicio de correo: cuenta SMTP con la que se envían credenciales y alertas */}
        <EmailSettingsPanel />
      </div>
    </AdminLayout>
  );
}
