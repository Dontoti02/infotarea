import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { SubmissionManagement } from "@/modules/teacher/components/SubmissionManagement";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function AdminDeliveriesPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-xl">
        <h2 className="text-headline-md font-bold text-on-surface">Gestión de Entregas</h2>
        <Suspense fallback={
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        }>
          <SubmissionManagement />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
