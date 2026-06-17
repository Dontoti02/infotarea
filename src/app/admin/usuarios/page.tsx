import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { UserManagement } from "@/modules/admin/components/UserManagement";

export default function UsersPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-xl">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-headline-lg font-bold text-on-surface mb-xs">Gestión de Usuarios</h2>
            <p className="text-body-md text-on-surface-variant">Administra las cuentas de alumnos, docentes y personal administrativo.</p>
          </div>
        </div>
        <UserManagement />
      </div>
    </AdminLayout>
  );
}
