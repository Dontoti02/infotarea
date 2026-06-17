import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { CourseDetails } from "@/shared/components/CourseDetails";

export default async function AdminCourseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <CourseDetails courseId={id} userRole="admin" />
      </div>
    </AdminLayout>
  );
}

