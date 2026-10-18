import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { AdminAcademicTracking } from "@/modules/admin/components/AdminAcademicTracking";
import { SmartSummaryPanel } from "@/modules/smart";

export default function AdminTrackingPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-xl">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface mb-xs">Seguimiento Global</h2>
          <p className="text-body-md text-on-surface-variant">Monitoreo del rendimiento académico de los estudiantes.</p>
        </div>

        {/* 21 y 22. Priorización de tareas, resúmenes de entregas y alertas automáticas */}
        <SmartSummaryPanel role="admin" />

        <AdminAcademicTracking />
      </div>
    </AdminLayout>
  );
}
