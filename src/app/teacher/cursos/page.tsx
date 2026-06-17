import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { CourseList } from "@/shared/components/CourseList";

export default function TeacherCoursesPage() {
  return (
    <TeacherLayout>
      <CourseList />
    </TeacherLayout>
  );
}
