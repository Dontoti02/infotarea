import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { AdminAcademicTracking } from "@/modules/admin/components/AdminAcademicTracking";

export default function AdminTrackingPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-xl">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface mb-xs">Seguimiento Global</h2>
          <p className="text-body-md text-on-surface-variant">Monitoreo del rendimiento académico de los estudiantes.</p>
        </div>
        <AdminAcademicTracking />
      </div>
    </AdminLayout>
  );
}
