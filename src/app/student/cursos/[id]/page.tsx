import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { CourseDetails } from "@/shared/components/CourseDetails";

export default async function StudentCourseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StudentLayout>
      <div className="p-4 md:p-8">
        <CourseDetails courseId={id} userRole="student" />
      </div>
    </StudentLayout>
  );
}

