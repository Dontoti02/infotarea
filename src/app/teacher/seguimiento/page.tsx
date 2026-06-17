import { TeacherLayout } from "@/modules/teacher/components/TeacherLayout";
import { TeacherAcademicTracking } from "@/modules/teacher/components/TeacherAcademicTracking";

export const metadata = {
  title: "Seguimiento Grupal | InfoTarea",
  description: "Monitorea el progreso académico de tus estudiantes por curso y sección.",
};

export default function TeacherSeguimientoPage() {
  return (
    <TeacherLayout>
      <TeacherAcademicTracking />
    </TeacherLayout>
  );
}
