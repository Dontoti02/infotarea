import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { SubmissionReview } from "@/modules/teacher/components/SubmissionReview";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminReviewSubmissionPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-128px)]">
        <div className="flex items-center gap-md mb-md">
          <Link
            href="/admin/tareas"
            className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 transition-all duration-150"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h2 className="text-headline-md font-bold text-on-surface leading-tight">Revisar Entrega</h2>
            <p className="text-body-md font-medium text-on-surface-variant">Evaluación y retroalimentación al alumno (Vista Admin)</p>
          </div>
        </div>
        <div className="flex-1 rounded-xl overflow-hidden border border-outline-variant shadow-sm">
          <SubmissionReview submissionId={id} />
        </div>
      </div>
    </AdminLayout>
  );
}
