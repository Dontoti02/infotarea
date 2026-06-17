import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { StudentTaskManagement } from "@/modules/student/components/StudentTaskManagement";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function StudentTasksPage() {
  return (
    <StudentLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      }>
        <StudentTaskManagement />
      </Suspense>
    </StudentLayout>
  );
}
