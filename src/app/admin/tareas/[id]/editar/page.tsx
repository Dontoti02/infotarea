import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { TaskCreation } from "@/modules/teacher/components/TaskCreation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminEditTaskPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-xl">
        <div className="flex items-center gap-md">
          <Link
            href="/admin/tareas"
            className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 transition-all duration-150"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h2 className="text-headline-md font-bold text-on-surface leading-tight">Editar Tarea</h2>
            <p className="text-body-md font-medium text-on-surface-variant">Modifica los detalles y requisitos de la tarea seleccionada.</p>
          </div>
        </div>
        <div className="flex-1 rounded-xl">
          <TaskCreation taskId={id} />
        </div>
      </div>
    </AdminLayout>
  );
}
