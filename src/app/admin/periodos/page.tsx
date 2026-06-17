import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { YearCloseSection } from "@/modules/admin/components/YearCloseSection";

export default function PeriodosPage() {
  return (
    <AdminLayout>
      <div className="mb-lg">
        <h1 className="text-display-sm font-black text-on-surface">Gestión de Periodos Anuales</h1>
        <p className="text-body-lg text-on-surface-variant mt-sm">
          Administra el historial de periodos escolares y realiza el cierre de año académico.
        </p>
      </div>

      <YearCloseSection />
    </AdminLayout>
  );
}
