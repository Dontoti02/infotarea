import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { AcademicTracking } from "@/modules/student/components/AcademicTracking";
import { StudentSmartAlerts } from "@/modules/smart";

export default function TrackingPage() {
  return (
    <StudentLayout>
      <div className="flex flex-col gap-xl">
        <h2 className="text-headline-md font-bold text-on-surface">Seguimiento Académico</h2>
        {/* 22 y 23. Avisos personales del componente inteligente dentro del sistema
            (el correo del bajo rendimiento llega solo a docentes y padres) */}
        <StudentSmartAlerts />
        <AcademicTracking />
      </div>
    </StudentLayout>
  );
}
