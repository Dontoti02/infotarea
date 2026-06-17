import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { RoleManagement } from "@/modules/admin/components/RoleManagement";

export default function RolesPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-xl">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface mb-xs">Roles y Permisos</h2>
          <p className="text-body-md text-on-surface-variant">Gestiona los niveles de acceso y los permisos de cada rol en la plataforma.</p>
        </div>
        <RoleManagement />
      </div>
    </AdminLayout>
  );
}
