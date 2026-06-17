import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { CourseList } from "@/shared/components/CourseList";

export default function AdminCoursesPage() {
  return (
    <AdminLayout>
      <CourseList />
    </AdminLayout>
  );
}
