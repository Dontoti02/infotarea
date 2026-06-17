import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { CourseDetails } from "@/shared/components/CourseDetails";

export default async function TeacherCourseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <TeacherLayout>
      <div className="p-4 md:p-8">
        <CourseDetails courseId={id} userRole="teacher" />
      </div>
    </TeacherLayout>
  );
}

