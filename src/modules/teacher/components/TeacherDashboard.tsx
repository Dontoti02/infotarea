"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  PlusCircle,
  School,
  FileText,
  History,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Users,
  BookOpen,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface CourseWithCount {
  id: string;
  name: string;
  section: string;
  schedule: string | null;
  image_url: string | null;
  studentCount: number;
}

interface PendingTask {
  id: string;
  title: string;
  course_name: string;
  due_date: string | null;
  submitted: number;
  total: number;
  urgent: boolean;
}

const COURSE_COLORS = [
  "bg-primary-container text-on-primary-container",
  "bg-tertiary-container text-on-tertiary",
  "bg-secondary-container text-on-secondary-container",
  "bg-error-container text-on-error-container",
];

function formatSection(sec: string) {
  if (!sec) return "";
  const gradeMatch = sec.match(/[1-5]/);
  const sectionMatch = sec.match(/[A-G]/i);
  if (gradeMatch && sectionMatch) {
    return `${gradeMatch[0]}° Grado – Sección ${sectionMatch[0].toUpperCase()}`;
  }
  return sec;
}

export function TeacherDashboard() {
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [publishedTasks, setPublishedTasks] = useState(0);
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [teacherName, setTeacherName] = useState("Docente");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch teacher profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) setTeacherName(profile.full_name);

      // Fetch assigned courses with student counts
      const { data: coursesRaw } = await supabase
        .from("courses")
        .select(`id, name, section, schedule, image_url, course_members(count)`)
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      let totalStu = 0;
      const formattedCourses: CourseWithCount[] = (coursesRaw || []).map(
        (c: any) => {
          const count = Array.isArray(c.course_members)
            ? c.course_members[0]?.count ?? 0
            : c.course_members?.count ?? 0;
          // Subtract 1 to exclude the teacher from student count
          const studentCount = Math.max(0, Number(count) - 1);
          totalStu += studentCount;
          return {
            id: c.id,
            name: c.name,
            section: c.section,
            schedule: c.schedule,
            image_url: c.image_url,
            studentCount,
          };
        }
      );
      setCourses(formattedCourses);
      setTotalStudents(totalStu);

      if (formattedCourses.length === 0) {
        setLoading(false);
        return;
      }

      const courseIds = formattedCourses.map((c) => c.id);

      // Fetch tasks for assigned courses
      const { data: tasksRaw } = await supabase
        .from("tasks")
        .select(`id, title, due_date, course_id, courses(name)`)
        .in("course_id", courseIds)
        .order("due_date", { ascending: true });

      const allTasks = tasksRaw || [];
      setPublishedTasks(allTasks.length);

      // Fetch submissions to calculate pending
      const taskIds = allTasks.map((t: any) => t.id);
      let submissionsRaw: any[] = [];
      if (taskIds.length > 0) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("id, task_id, status")
          .in("task_id", taskIds);
        submissionsRaw = subs || [];
      }

      // Group submissions by task_id
      const subsByTask: Record<string, number> = {};
      const gradedByTask: Record<string, number> = {};
      submissionsRaw.forEach((s: any) => {
        subsByTask[s.task_id] = (subsByTask[s.task_id] || 0) + 1;
        if (s.status !== "graded") {
          gradedByTask[s.task_id] = (gradedByTask[s.task_id] || 0) + 1;
        }
      });

      // Compute total pending reviews
      const totalPending = submissionsRaw.filter(
        (s: any) => s.status !== "graded"
      ).length;
      setPendingSubmissions(totalPending);

      // Build pending task list (tasks with ungraded submissions or upcoming)
      const now = new Date();
      const pending: PendingTask[] = allTasks
        .slice(0, 5)
        .map((t: any) => {
          const courseStudentCount =
            formattedCourses.find((c) => c.id === t.course_id)?.studentCount ||
            0;
          const submitted = subsByTask[t.id] || 0;
          const ungraded = gradedByTask[t.id] || 0;
          const dueDate = t.due_date ? new Date(t.due_date) : null;
          const urgent =
            dueDate !== null &&
            dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          return {
            id: t.id,
            title: t.title,
            course_name: (t.courses as any)?.name || "",
            due_date: t.due_date,
            submitted,
            total: courseStudentCount,
            urgent,
          };
        })
        .filter((t) => t.submitted > 0 || t.urgent);
      setPendingTasks(pending);

      setLoading(false);
    }

    loadData();
  }, []);

  const kpis = [
    {
      label: "Cursos Asignados",
      value: loading ? "–" : String(courses.length),
      icon: <School size={20} />,
      color: "bg-surface-container text-primary",
      sub: "Semestre activo",
      subIcon: <TrendingUp size={14} />,
      isError: false,
    },
    {
      label: "Tareas Publicadas",
      value: loading ? "–" : String(publishedTasks),
      icon: <FileText size={20} />,
      color: "bg-surface-container text-tertiary",
      sub: `${courses.length} curso${courses.length !== 1 ? "s" : ""}`,
      subIcon: <Clock size={14} />,
      isError: false,
    },
    {
      label: "Entregas Pendientes",
      value: loading ? "–" : String(pendingSubmissions),
      icon: <History size={20} />,
      color: "bg-error-container text-error",
      sub: "Requiere revisión",
      subIcon: <AlertCircle size={14} />,
      isError: pendingSubmissions > 0,
    },
    {
      label: "Total Estudiantes",
      value: loading ? "–" : String(totalStudents),
      icon: <GraduationCap size={20} />,
      color: "bg-surface-container text-secondary",
      sub: "Todos tus grupos",
      subIcon: <Users size={14} />,
      isError: false,
    },
  ];

  const firstName = teacherName.split(" ")[0];

  return (
    <div className="space-y-xl">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
        <div>
          <h2 className="text-headline-md font-bold text-on-surface">
            Hola, {firstName} 👋
          </h2>
          <p className="text-body-md font-medium text-on-surface-variant mt-xs">
            Aquí está el resumen de tus actividades académicas.
          </p>
        </div>
        <div className="flex gap-md">
          <button
            onClick={() => router.push("/teacher/contenido")}
            className="flex items-center gap-sm px-lg py-sm rounded-full border border-outline text-primary hover:bg-surface-container transition-colors font-bold text-label-md"
          >
            <Upload size={18} /> Subir Material
          </button>
          <button
            onClick={() => router.push("/teacher/tareas")}
            className="flex items-center gap-sm px-lg py-sm rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm font-bold text-label-md"
          >
            <PlusCircle size={18} /> Publicar Tarea
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant/30 hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">
                  {kpi.label}
                </p>
                {loading ? (
                  <div className="h-10 w-16 bg-surface-container animate-pulse rounded-lg mt-sm" />
                ) : (
                  <h3
                    className={`text-display-lg font-bold mt-sm ${kpi.isError ? "text-error" : "text-on-surface"}`}
                  >
                    {kpi.value}
                  </h3>
                )}
              </div>
              <div className={`p-3 rounded-lg ${kpi.color}`}>{kpi.icon}</div>
            </div>
            <div
              className={`mt-md flex items-center gap-xs font-bold text-label-sm ${kpi.isError ? "text-error" : "text-secondary"}`}
            >
              {kpi.subIcon}
              <span>{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
        {/* Left: Courses & Reviews */}
        <div className="lg:col-span-8 space-y-xl">
          {/* Courses */}
          <section>
            <div className="flex justify-between items-center mb-md">
              <h3 className="text-title-lg font-bold text-on-surface">
                Mis Cursos Asignados
              </h3>
              <button
                onClick={() => router.push("/teacher/cursos")}
                className="text-label-md font-bold text-primary hover:underline"
              >
                Ver todos
              </button>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-surface-container-lowest rounded-xl animate-pulse border border-outline-variant/30"
                  />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <BookOpen size={32} className="opacity-40" />
                <p className="text-body-md font-medium">
                  No tienes cursos asignados aún.
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  Contacta al administrador para que te asigne cursos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                {courses.map((course, idx) => (
                  <div
                    key={course.id}
                    onClick={() =>
                      router.push(`/teacher/cursos/${course.id}`)
                    }
                    className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-md flex items-center gap-md hover:border-primary transition-all cursor-pointer group hover:shadow-md"
                  >
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${COURSE_COLORS[idx % COURSE_COLORS.length]}`}
                    >
                      <LayoutDashboard size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-label-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                        {course.name}
                      </h4>
                      <p className="text-label-sm font-medium text-on-surface-variant mt-0.5 truncate">
                        {formatSection(course.section)}
                      </p>
                      <div className="flex items-center gap-xs mt-1">
                        <Users size={12} className="text-outline" />
                        <span className="text-label-sm text-outline">
                          {course.studentCount} estudiante
                          {course.studentCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className="text-outline-variant group-hover:text-primary transition-colors shrink-0"
                      size={18}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pending Reviews */}
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/20">
              <h3 className="text-title-lg font-bold text-on-surface">
                Entregas Recientes
              </h3>
              <button
                onClick={() => router.push("/teacher/entregas")}
                className="text-label-md font-bold text-primary hover:underline"
              >
                Ver todas
              </button>
            </div>
            {loading ? (
              <div className="divide-y divide-outline-variant/30">
                {[1, 2].map((i) => (
                  <div key={i} className="p-lg">
                    <div className="h-5 w-48 bg-surface-container animate-pulse rounded mb-2" />
                    <div className="h-4 w-32 bg-surface-container animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
                <CheckCircle2 size={32} className="text-secondary opacity-60" />
                <p className="text-body-md font-medium">
                  ¡Todo al día! Sin entregas pendientes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/30">
                {pendingTasks.map((rev) => {
                  const progress =
                    rev.total > 0
                      ? Math.round((rev.submitted / rev.total) * 100)
                      : 0;
                  return (
                    <div
                      key={rev.id}
                      className="p-lg hover:bg-surface-container-low/30 transition-colors flex flex-col sm:flex-row gap-md sm:items-center"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-sm mb-xs flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-label-sm ${rev.urgent ? "bg-error-container text-on-error-container" : "bg-surface-container-high text-on-surface-variant"}`}
                          >
                            {rev.urgent ? "Urgente" : "Normal"}
                          </span>
                          <h4 className="text-label-md font-bold text-on-surface">
                            {rev.title}
                          </h4>
                        </div>
                        <p className="text-body-sm font-medium text-on-surface-variant">
                          {rev.course_name}
                        </p>
                      </div>
                      <div className="w-full sm:w-44">
                        <div className="flex justify-between text-label-sm font-bold text-on-surface-variant mb-xs">
                          <span>Entregas</span>
                          <span>
                            {rev.submitted}/{rev.total} ({progress}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progress > 80 ? "bg-secondary" : "bg-primary"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => router.push("/teacher/entregas")}
                        className="px-lg py-2 rounded-lg bg-surface-container text-primary hover:bg-primary hover:text-on-primary font-bold text-label-md transition-all shrink-0"
                      >
                        Revisar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right: Quick Links + Students Summary */}
        <div className="lg:col-span-4 space-y-lg">
          {/* Seguimiento rápido */}
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm p-lg">
            <h3 className="text-title-lg font-bold text-on-surface mb-md">
              Accesos Rápidos
            </h3>
            <div className="space-y-sm">
              {[
                {
                  label: "Seguimiento Grupal",
                  href: "/teacher/seguimiento",
                  icon: <GraduationCap size={18} />,
                  desc: "Ver alumnos por grupo",
                },
                {
                  label: "Gestión de Tareas",
                  href: "/teacher/tareas",
                  icon: <FileText size={18} />,
                  desc: "Crear y gestionar tareas",
                },
                {
                  label: "Revisión de Entregas",
                  href: "/teacher/entregas",
                  icon: <History size={18} />,
                  desc: "Calificar entregas",
                },
                {
                  label: "Mis Cursos",
                  href: "/teacher/cursos",
                  icon: <School size={18} />,
                  desc: "Ver todos los cursos",
                },
              ].map((link) => (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className="w-full flex items-center gap-md p-md rounded-xl hover:bg-surface-container-low border border-transparent hover:border-outline-variant/50 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-all">
                    {link.icon}
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-on-surface">
                      {link.label}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {link.desc}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="ml-auto text-outline-variant group-hover:text-primary transition-colors"
                  />
                </button>
              ))}
            </div>
          </section>

          {/* Resumen de grupos */}
          {!loading && courses.length > 0 && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm p-lg">
              <h3 className="text-title-lg font-bold text-on-surface mb-md">
                Mis Grupos
              </h3>
              <div className="space-y-sm">
                {courses.map((course, idx) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-sm rounded-lg hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-sm">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${["bg-primary", "bg-tertiary", "bg-secondary", "bg-error"][idx % 4]}`}
                      />
                      <div>
                        <p className="text-label-sm font-bold text-on-surface truncate max-w-[130px]">
                          {course.name}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {formatSection(course.section)}
                        </p>
                      </div>
                    </div>
                    <span className="text-label-sm font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                      {course.studentCount} alum.
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
