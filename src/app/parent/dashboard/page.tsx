"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  MessageSquare, 
  UserPlus, 
  Award, 
  Calendar, 
  ChevronRight, 
  Loader2,
  TrendingUp,
  Sparkles,
  Search,
  ExternalLink
} from "lucide-react";
import { ParentLayout } from "@/modules/parent/components/ParentLayout";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ChildData {
  id: string;
  full_name: string;
  email?: string;
  section: string;
  courses: Array<{
    id: string;
    name: string;
    section: string;
    image_url?: string;
    teacher?: {
      id: string;
      full_name: string;
      email: string;
    };
  }>;
  teachers: Array<{
    id: string;
    full_name: string;
    email: string;
    courseName: string;
    section: string;
  }>;
  stats: {
    averageScore: number | null;
    highestScore: number | null;
    totalSubmissions: number;
    pendingTasksCount: number;
    coursesCount: number;
  };
  submissions: Array<{
    id: string;
    task_id: string;
    status: string;
    score: number | null;
    feedback: string | null;
    created_at: string;
    tasks?: {
      id: string;
      title: string;
      task_type: string;
      due_date: string;
      courses?: {
        name: string;
        section: string;
      };
    };
  }>;
  pendingTasks: Array<{
    id: string;
    title: string;
    description: string;
    due_date: string;
    task_type: string;
    courses?: {
      name: string;
      section: string;
    };
  }>;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"resumen" | "calificaciones" | "tareas" | "docentes">("resumen");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/parents/children");
        const data = await res.json();
        if (data.children) {
          setChildren(data.children);
          if (data.children.length === 0) {
            router.push("/parent/onboarding");
          }
        }
      } catch (err) {
        console.error("Error loading parent dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  if (loading) {
    return (
      <ParentLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={36} />
          <p className="text-sm font-semibold text-on-surface-variant">Cargando el panel familiar...</p>
        </div>
      </ParentLayout>
    );
  }

  if (children.length === 0) {
    return (
      <ParentLayout>
        <div className="p-8 text-center bg-surface-container-lowest rounded-3xl border border-outline-variant/30 space-y-4 max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-on-surface">No tienes hijos vinculados</h2>
          <p className="text-sm text-on-surface-variant">
            Para acceder a las calificaciones, tareas y comunicarte con los profesores, vincula a tu primer hijo.
          </p>
          <Link
            href="/parent/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-container transition-all"
          >
            <UserPlus size={18} />
            <span>Vincular a mi hijo</span>
          </Link>
        </div>
      </ParentLayout>
    );
  }

  const activeChild = children[selectedChildIndex] || children[0];

  return (
    <ParentLayout>
      <div className="space-y-6 pb-12">
        {/* Child Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/20 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-2 hidden sm:inline">
              Viendo a:
            </span>
            {children.map((child, idx) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildIndex(idx)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                  selectedChildIndex === idx
                    ? "bg-primary text-on-primary shadow-sm scale-102"
                    : "bg-surface hover:bg-surface-container text-on-surface-variant border border-outline-variant/30"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                    selectedChildIndex === idx
                      ? "bg-on-primary/20 text-on-primary"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {child.full_name.charAt(0).toUpperCase()}
                </div>
                <span>{child.full_name}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                    selectedChildIndex === idx
                      ? "bg-on-primary/25 text-on-primary"
                      : "bg-outline-variant/20 text-on-surface-variant"
                  }`}
                >
                  Sec. {child.section}
                </span>
              </button>
            ))}
          </div>

          {/* Add Another Child Button */}
          <Link
            href="/parent/onboarding"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 border border-primary/20 transition-all ml-auto"
          >
            <UserPlus size={16} />
            <span>+ Agregar otro hijo</span>
          </Link>
        </div>

        {/* Student Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary-container/20 via-surface-container to-surface rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider">
              <GraduationCap size={14} />
              <span>Ficha Académica del Estudiante</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface">
              {activeChild.full_name}
            </h1>
            <p className="text-sm text-on-surface-variant">
              Matriculado en <strong className="text-on-surface">Sección {activeChild.section}</strong> • {activeChild.courses.length} curso(s) activos
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/parent/comunicacion"
              className="px-5 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container shadow-md flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <MessageSquare size={18} />
              <span>Chatear con Docentes</span>
            </Link>
          </div>
        </div>

        {/* Top KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Calificación promedio */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Promedio General
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Award size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface">
                {activeChild.stats.averageScore !== null ? activeChild.stats.averageScore : "—"}
              </span>
              <span className="text-xs text-on-surface-variant font-bold">/ 20</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {activeChild.stats.averageScore !== null && activeChild.stats.averageScore >= 14
                ? "🌟 Rendimiento destacado"
                : activeChild.stats.averageScore !== null
                ? "📚 En seguimiento regular"
                : "Sin calificaciones registradas"}
            </p>
          </div>

          {/* Tareas pendientes */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Tareas Pendientes
              </span>
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface">
                {activeChild.stats.pendingTasksCount}
              </span>
              <span className="text-xs text-on-surface-variant font-bold">por entregar</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {activeChild.stats.pendingTasksCount === 0
                ? "✓ Al día con todas sus entregas"
                : "Requiere atención del estudiante"}
            </p>
          </div>

          {/* Entregas realizadas */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Entregas Realizadas
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileCheck size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface">
                {activeChild.stats.totalSubmissions}
              </span>
              <span className="text-xs text-on-surface-variant font-bold">trabajos</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Evaluados por sus respectivos docentes
            </p>
          </div>

          {/* Cursos Matriculados */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Cursos Activos
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <BookOpen size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface">
                {activeChild.courses.length}
              </span>
              <span className="text-xs text-on-surface-variant font-bold">materias</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Sección: {activeChild.section}
            </p>
          </div>
        </div>

        {/* View Navigation Tabs */}
        <div className="border-b border-outline-variant/20 flex items-center gap-2 overflow-x-auto">
          {[
            { id: "resumen", label: "Resumen General", icon: TrendingUp },
            { id: "calificaciones", label: "Calificaciones", icon: Award },
            { id: "tareas", label: "Tareas y Asignaciones", icon: FileCheck },
            { id: "docentes", label: "Docentes y Cursos", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: RESUMEN GENERAL */}
        {activeTab === "resumen" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tareas Pendientes */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="text-primary" size={20} />
                  <h3 className="font-bold text-base text-on-surface">Próximas Tareas Pendientes</h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {activeChild.pendingTasks.length} pendiente(s)
                </span>
              </div>

              {activeChild.pendingTasks.length === 0 ? (
                <div className="p-8 text-center bg-surface rounded-2xl border border-dashed border-outline-variant/40">
                  <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                  <p className="text-sm font-semibold text-on-surface">¡Sin tareas pendientes!</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    El alumno no tiene tareas programadas por entregar en este momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeChild.pendingTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="p-4 rounded-2xl bg-surface border border-outline-variant/30 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                          {task.courses?.name || "Curso"}
                        </span>
                        <h4 className="font-bold text-sm text-on-surface">{task.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                          <Calendar size={13} />
                          <span>
                            Vence: {new Date(task.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600">
                        Por entregar
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Últimas Calificaciones */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="text-amber-500" size={20} />
                  <h3 className="font-bold text-base text-on-surface">Últimas Calificaciones</h3>
                </div>
                <span className="text-xs font-bold text-on-surface-variant">
                  {activeChild.submissions.length} evaluada(s)
                </span>
              </div>

              {activeChild.submissions.length === 0 ? (
                <div className="p-8 text-center bg-surface rounded-2xl border border-dashed border-outline-variant/40">
                  <Award className="mx-auto text-outline-variant mb-2" size={32} />
                  <p className="text-sm font-semibold text-on-surface">Aún no hay calificaciones registradas</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Aparecerán aquí cuando los docentes califiquen las tareas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeChild.submissions.slice(0, 5).map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl bg-surface border border-outline-variant/30 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {sub.tasks?.courses?.name || "Materia"}
                        </span>
                        <h4 className="font-bold text-sm text-on-surface">
                          {sub.tasks?.title || "Tarea"}
                        </h4>
                        {sub.feedback && (
                          <p className="text-xs text-on-surface-variant italic">
                            &ldquo;{sub.feedback}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        {sub.score !== null ? (
                          <div
                            className={`px-3 py-1.5 rounded-xl font-black text-sm ${
                              sub.score >= 14
                                ? "bg-emerald-500/15 text-emerald-600"
                                : sub.score >= 11
                                ? "bg-amber-500/15 text-amber-600"
                                : "bg-error/15 text-error"
                            }`}
                          >
                            {sub.score} / 20
                          </div>
                        ) : (
                          <span className="text-xs font-bold px-2 py-1 rounded-lg bg-surface-container text-on-surface-variant">
                            En revisión
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CALIFICACIONES */}
        {activeTab === "calificaciones" && (
          <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Registro Completo de Calificaciones</h3>
                <p className="text-xs text-on-surface-variant">
                  Evaluaciones con nota vigesimal y retroalimentación pedagógica
                </p>
              </div>
            </div>

            {activeChild.submissions.length === 0 ? (
              <div className="p-12 text-center bg-surface rounded-2xl border border-dashed border-outline-variant/40">
                <Award className="mx-auto text-outline-variant mb-3" size={40} />
                <p className="text-sm font-semibold text-on-surface">No hay notas registradas para este periodo</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                      <th className="pb-3 px-3">Asignatura</th>
                      <th className="pb-3 px-3">Tarea / Actividad</th>
                      <th className="pb-3 px-3">Fecha</th>
                      <th className="pb-3 px-3">Estado</th>
                      <th className="pb-3 px-3 text-right">Calificación</th>
                      <th className="pb-3 px-3">Comentarios del Docente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {activeChild.submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-4 px-3 font-bold text-on-surface">
                          {sub.tasks?.courses?.name || "Curso"}
                        </td>
                        <td className="py-4 px-3 text-on-surface">
                          {sub.tasks?.title || "Evaluación"}
                        </td>
                        <td className="py-4 px-3 text-xs text-on-surface-variant whitespace-nowrap">
                          {new Date(sub.created_at).toLocaleDateString("es-ES")}
                        </td>
                        <td className="py-4 px-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              sub.status === "reviewed"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {sub.status === "reviewed" ? "Calificado" : "Pendiente"}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          {sub.score !== null ? (
                            <span
                              className={`font-black text-sm px-2.5 py-1 rounded-lg ${
                                sub.score >= 14
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : "bg-amber-500/15 text-amber-600"
                              }`}
                            >
                              {sub.score} / 20
                            </span>
                          ) : (
                            <span className="text-xs text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-xs text-on-surface-variant italic max-w-xs truncate">
                          {sub.feedback || "Sin observaciones"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TAREAS Y ASIGNACIONES */}
        {activeTab === "tareas" && (
          <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Todas las Tareas y Actividades</h3>
              <p className="text-xs text-on-surface-variant">
                Control de entregas y plazos límites para las asignaturas del alumno
              </p>
            </div>

            <div className="space-y-4">
              {activeChild.pendingTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-surface border border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                        {t.courses?.name}
                      </span>
                      <span className="text-xs text-on-surface-variant uppercase font-semibold">
                        Tipo: {t.task_type}
                      </span>
                    </div>
                    <h4 className="font-bold text-base text-on-surface">{t.title}</h4>
                    {t.description && (
                      <p className="text-xs text-on-surface-variant max-w-xl">{t.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-xs">
                      <span className="text-on-surface-variant block">Fecha límite:</span>
                      <span className="font-bold text-error">
                        {new Date(t.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 font-bold text-xs">
                      Pendiente
                    </span>
                  </div>
                </div>
              ))}

              {activeChild.pendingTasks.length === 0 && (
                <div className="p-8 text-center bg-surface rounded-2xl border border-dashed border-outline-variant/40">
                  <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                  <p className="text-sm font-semibold text-on-surface">No hay tareas pendientes en este momento</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DOCENTES Y ASIGNATURAS */}
        {activeTab === "docentes" && (
          <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Docentes a Cargo</h3>
                <p className="text-xs text-on-surface-variant">
                  Profesores responsables de las asignaturas de tu hijo
                </p>
              </div>

              <Link
                href="/parent/comunicacion"
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1.5 hover:bg-primary-container transition-all"
              >
                <MessageSquare size={16} />
                <span>Ir al Chat Familiar</span>
              </Link>
            </div>

            {activeChild.teachers.length === 0 ? (
              <div className="p-8 text-center bg-surface rounded-2xl border border-dashed border-outline-variant/40">
                <Users className="mx-auto text-outline-variant mb-2" size={32} />
                <p className="text-sm font-semibold text-on-surface">No hay docentes asignados todavía</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeChild.teachers.map((teacher, idx) => (
                  <div
                    key={`${teacher.id}-${idx}`}
                    className="p-5 rounded-2xl bg-surface border border-outline-variant/30 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-violet-500/10 text-violet-600 font-bold flex items-center justify-center text-base shrink-0">
                        {teacher.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-on-surface truncate">
                          {teacher.full_name}
                        </h4>
                        <p className="text-xs text-primary font-semibold truncate">
                          {teacher.courseName}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          Sección: {teacher.section}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/parent/comunicacion"
                      className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <MessageSquare size={14} />
                      <span>Mensaje</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ParentLayout>
  );
}
