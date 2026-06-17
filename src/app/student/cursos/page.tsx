import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { CourseList } from "@/shared/components/CourseList";

export default function StudentCoursesPage() {
  return (
    <StudentLayout>
      <CourseList />
    </StudentLayout>
  );
}
