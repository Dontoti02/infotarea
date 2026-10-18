import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { TeacherAcademicTracking } from "@/modules/teacher/components/TeacherAcademicTracking";
import { SmartSummaryPanel } from "@/modules/smart";

export const metadata = {
  title: "Seguimiento Grupal | InfoTarea",
  description: "Monitorea el progreso académico de tus estudiantes por curso y sección.",
};

export default function TeacherSeguimientoPage() {
  return (
    <TeacherLayout>
      <div className="flex flex-col gap-xl">
        {/* 21 y 22. Clasificación de tareas y resúmenes de entregas de mis asignaturas */}
        <SmartSummaryPanel role="teacher" />

        <TeacherAcademicTracking />
      </div>
    </TeacherLayout>
  );
}
