import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { StudentSubmissions } from "@/modules/student/components/StudentSubmissions";

export default function StudentDeliveriesPage() {
  return (
    <StudentLayout>
      <StudentSubmissions />
    </StudentLayout>
  );
}
