import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { TaskManagement } from "@/modules/teacher/components/TaskManagement";

export default function AdminTasksPage() {
  return (
    <AdminLayout>
      <TaskManagement />
    </AdminLayout>
  );
}
