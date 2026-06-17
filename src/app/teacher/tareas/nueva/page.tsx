import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { TaskCreation } from "@/modules/teacher/components/TaskCreation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

export default function CreateTaskPage() {
  return (
    <TeacherLayout>
      <div className="flex flex-col gap-xl">
        <div className="flex items-center gap-md">
          <Link
            href="/teacher/tareas"
            className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 transition-all duration-150"
          >
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-headline-md font-bold text-on-surface">Crear Nueva Tarea</h2>
        </div>
        <Suspense>
          <TaskCreation />
        </Suspense>
      </div>
    </TeacherLayout>
  );
}
