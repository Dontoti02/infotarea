import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { AcademicTracking } from "@/modules/student/components/AcademicTracking";

export default function TrackingPage() {
  return (
    <StudentLayout>
      <div className="flex flex-col gap-xl">
        <h2 className="text-headline-md font-bold text-on-surface">Seguimiento Académico</h2>
        <AcademicTracking />
      </div>
    </StudentLayout>
  );
}
