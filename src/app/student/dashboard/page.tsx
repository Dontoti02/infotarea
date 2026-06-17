import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { StudentDashboard } from "@/modules/student/components/StudentDashboard";

export default function StudentDashboardPage() {
  return (
    <StudentLayout>
      <StudentDashboard />
    </StudentLayout>
  );
}
