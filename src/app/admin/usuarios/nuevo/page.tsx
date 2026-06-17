import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { CreateUserForm } from "@/modules/admin/components/CreateUserForm";

export default function CreateUserPage() {
  return (
    <AdminLayout>
      <CreateUserForm />
    </AdminLayout>
  );
}
