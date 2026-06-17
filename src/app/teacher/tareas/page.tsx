import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { TaskManagement } from "@/modules/teacher/components/TaskManagement";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function TasksPage() {
  return (
    <TeacherLayout>
      <div className="flex flex-col gap-xl">
        <div className="flex justify-between items-center">
          <h2 className="text-headline-md font-bold text-on-surface">Gestión de Tareas</h2>
          <Link 
            href="/teacher/tareas/nueva"
            className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm flex items-center gap-sm"
          >
            <Plus size={18} /> Crear Tarea
          </Link>
        </div>
        <TaskManagement />
      </div>
    </TeacherLayout>
  );
}
