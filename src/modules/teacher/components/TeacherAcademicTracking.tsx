"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Users,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  BarChart3,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface StudentRow {
  id: string;
  full_name: string;
  email?: string;
  submissions: {
    task_id: string;
    task_title: string;
    status: string;
    grade: number | null;
    submitted_at: string | null;
  }[];
  completedTasks: number;
  totalTasks: number;
  avgGrade: number | null;
}

interface CourseGroup {
  id: string;
  name: string;
  section: string;
  students: StudentRow[];
  tasks: { id: string; title: string; due_date: string | null }[];
  totalTasks: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  graded: {
    label: "Calificado",
    color: "bg-secondary/10 text-secondary",
    icon: <CheckCircle2 size={12} />,
  },
  submitted: {
    label: "Entregado",
    color: "bg-primary/10 text-primary",
    icon: <Clock size={12} />,
  },
  late: {
    label: "Tardío",
    color: "bg-error/10 text-error",
    icon: <AlertCircle size={12} />,
  },
  pending: {
    label: "Pendiente",
    color: "bg-outline/10 text-outline",
    icon: <FileText size={12} />,
  },
};

function formatSection(sec: string) {
  if (!sec) return "";
  const gradeMatch = sec.match(/[1-5]/);
  const sectionMatch = sec.match(/[A-G]/i);
  if (gradeMatch && sectionMatch) {
    return `${gradeMatch[0]}° Grado – Sección ${sectionMatch[0].toUpperCase()}`;
  }
  return sec;
}

function StudentStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["pending"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function CourseGroupPanel({ group }: { group: CourseGroup }) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState("");

  const filtered = group.students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const overallCompletion =
    group.students.length > 0 && group.totalTasks > 0
      ? Math.round(
          (group.students.reduce((acc, s) => acc + s.completedTasks, 0) /
            (group.students.length * group.totalTasks)) *
            100
        )
      : 0;

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="p-lg flex items-center justify-between cursor-pointer hover:bg-surface-container-low/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-md">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen size={22} />
          </div>
          <div>
            <h3 className="text-title-md font-bold text-on-surface">
              {group.name}
            </h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              {formatSection(group.section)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-lg">
          <div className="hidden sm:flex items-center gap-xl">
            <div className="text-center">
              <p className="text-display-sm font-bold text-on-surface">
                {group.students.length}
              </p>
              <p className="text-label-sm text-on-surface-variant">Alumnos</p>
            </div>
            <div className="text-center">
              <p className="text-display-sm font-bold text-on-surface">
                {group.totalTasks}
              </p>
              <p className="text-label-sm text-on-surface-variant">Tareas</p>
            </div>
            <div className="text-center">
              <p
                className={`text-display-sm font-bold ${overallCompletion >= 70 ? "text-secondary" : overallCompletion >= 40 ? "text-primary" : "text-error"}`}
              >
                {overallCompletion}%
              </p>
              <p className="text-label-sm text-on-surface-variant">
                Completado
              </p>
            </div>
          </div>

          {/* Completion bar */}
          <div className="hidden md:flex flex-col gap-1 w-28">
            <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${overallCompletion >= 70 ? "bg-secondary" : overallCompletion >= 40 ? "bg-primary" : "bg-error"}`}
                style={{ width: `${overallCompletion}%` }}
              />
            </div>
            <span className="text-[10px] text-on-surface-variant font-bold text-right">
              Progreso del grupo
            </span>
          </div>

          {expanded ? (
            <ChevronDown size={20} className="text-outline shrink-0" />
          ) : (
            <ChevronRight size={20} className="text-outline shrink-0" />
          )}
        </div>
      </div>

      {/* Expanded table */}
      {expanded && (
        <div className="border-t border-outline-variant/30">
          {/* Search */}
          <div className="p-md border-b border-outline-variant/20 bg-surface-container-low/10">
            <div className="relative max-w-xs">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              />
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 text-label-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          {group.students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
              <Users size={32} className="opacity-40" />
              <p className="text-body-md font-medium">
                No hay estudiantes en este curso.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-on-surface-variant">
              <Search size={24} className="opacity-40" />
              <p className="text-label-md">Sin resultados para "{search}"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-low/20">
                    <th className="text-left px-lg py-3 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider sticky left-0 bg-surface-container-low/20">
                      Alumno
                    </th>
                    {group.tasks.slice(0, 6).map((task) => (
                      <th
                        key={task.id}
                        className="text-center px-3 py-3 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider min-w-[110px]"
                        title={task.title}
                      >
                        <span className="truncate block max-w-[100px] mx-auto">
                          {task.title.length > 14
                            ? task.title.slice(0, 14) + "…"
                            : task.title}
                        </span>
                      </th>
                    ))}
                    {group.tasks.length > 6 && (
                      <th className="text-center px-3 py-3 text-label-sm font-bold text-on-surface-variant">
                        +{group.tasks.length - 6} más
                      </th>
                    )}
                    <th className="text-center px-lg py-3 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
                      Promedio
                    </th>
                    <th className="text-center px-lg py-3 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
                      Avance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filtered.map((student) => {
                    const progress =
                      group.totalTasks > 0
                        ? Math.round(
                            (student.completedTasks / group.totalTasks) * 100
                          )
                        : 0;
                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-surface-container-low/30 transition-colors"
                      >
                        <td className="px-lg py-3 sticky left-0 bg-surface-container-lowest">
                          <div className="flex items-center gap-sm">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-label-sm font-bold shrink-0">
                              {student.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-label-md font-semibold text-on-surface whitespace-nowrap">
                              {student.full_name}
                            </span>
                          </div>
                        </td>
                        {group.tasks.slice(0, 6).map((task) => {
                          const sub = student.submissions.find(
                            (s) => s.task_id === task.id
                          );
                          const status = sub?.status || "pending";
                          return (
                            <td
                              key={task.id}
                              className="text-center px-3 py-3"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <StudentStatusBadge status={status} />
                                {sub?.grade !== null &&
                                  sub?.grade !== undefined && (
                                    <span className="text-[11px] font-bold text-on-surface">
                                      {sub.grade}
                                    </span>
                                  )}
                              </div>
                            </td>
                          );
                        })}
                        {group.tasks.length > 6 && <td />}
                        <td className="text-center px-lg py-3">
                          {student.avgGrade !== null ? (
                            <span
                              className={`text-label-md font-bold ${student.avgGrade >= 14 ? "text-secondary" : student.avgGrade >= 11 ? "text-primary" : "text-error"}`}
                            >
                              {student.avgGrade.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-outline text-label-sm">
                              –
                            </span>
                          )}
                        </td>
                        <td className="px-lg py-3">
                          <div className="flex items-center gap-sm justify-center">
                            <div className="w-16 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${progress >= 70 ? "bg-secondary" : progress >= 40 ? "bg-primary" : "bg-error"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-label-sm font-bold text-on-surface-variant w-8 text-right">
                              {progress}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TeacherAcademicTracking() {
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTracking() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch courses assigned to teacher
      const { data: coursesRaw, error: coursesErr } = await supabase
        .from("courses")
        .select("id, name, section")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (coursesErr) {
        setError("Error al cargar los cursos: " + coursesErr.message);
        setLoading(false);
        return;
      }

      if (!coursesRaw || coursesRaw.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const courseIds = coursesRaw.map((c) => c.id);

      // 2. Fetch course_members to find students per course (role = student)
      const { data: membersRaw } = await supabase
        .from("course_members")
        .select("course_id, profile_id, profiles(id, full_name, role)")
        .in("course_id", courseIds);

      // 3. Fetch tasks per course
      const { data: tasksRaw } = await supabase
        .from("tasks")
        .select("id, title, due_date, course_id")
        .in("course_id", courseIds)
        .order("due_date", { ascending: true });

      // 4. Fetch submissions for all tasks
      const allTasks = tasksRaw || [];
      const taskIds = allTasks.map((t: any) => t.id);
      let allSubmissions: any[] = [];
      if (taskIds.length > 0) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("id, task_id, student_id, status, grade, submitted_at")
          .in("task_id", taskIds);
        allSubmissions = subs || [];
      }

      // 5. Build groups
      const built: CourseGroup[] = coursesRaw.map((course) => {
        const courseTasks = allTasks.filter(
          (t: any) => t.course_id === course.id
        );
        const courseMembers = (membersRaw || []).filter(
          (m: any) =>
            m.course_id === course.id &&
            (m.profiles as any)?.role === "student"
        );

        const students: StudentRow[] = courseMembers.map((m: any) => {
          const profile = m.profiles as any;
          const studentSubs = allSubmissions.filter(
            (s: any) => s.student_id === profile.id
          );

          const gradedSubs = studentSubs.filter(
            (s: any) => s.grade !== null && s.grade !== undefined
          );
          const avgGrade =
            gradedSubs.length > 0
              ? gradedSubs.reduce(
                  (acc: number, s: any) => acc + Number(s.grade),
                  0
                ) / gradedSubs.length
              : null;

          const submissionsMap = studentSubs.map((s: any) => ({
            task_id: s.task_id,
            task_title:
              courseTasks.find((t: any) => t.id === s.task_id)?.title || "",
            status: s.status || "submitted",
            grade: s.grade,
            submitted_at: s.submitted_at,
          }));

          const completedTasks = studentSubs.filter(
            (s: any) =>
              s.status === "submitted" ||
              s.status === "graded" ||
              s.status === "late"
          ).length;

          return {
            id: profile.id,
            full_name: profile.full_name || "Sin nombre",
            submissions: submissionsMap,
            completedTasks,
            totalTasks: courseTasks.length,
            avgGrade,
          };
        });

        return {
          id: course.id,
          name: course.name,
          section: course.section,
          students,
          tasks: courseTasks,
          totalTasks: courseTasks.length,
        };
      });

      setGroups(built);
      setLoading(false);
    }

    loadTracking();
  }, []);

  const totalStudents = groups.reduce((acc, g) => acc + g.students.length, 0);
  const totalTasks = groups.reduce((acc, g) => acc + g.totalTasks, 0);
  const avgCompletion =
    groups.length > 0
      ? Math.round(
          groups.reduce((acc, g) => {
            if (g.students.length === 0 || g.totalTasks === 0) return acc;
            const groupPct =
              g.students.reduce((a, s) => a + s.completedTasks, 0) /
              (g.students.length * g.totalTasks);
            return acc + groupPct * 100;
          }, 0) / groups.filter((g) => g.students.length > 0 && g.totalTasks > 0).length
        )
      : 0;

  return (
    <div className="space-y-xl">
      {/* Header */}
      <div>
        <h2 className="text-headline-md font-bold text-on-surface flex items-center gap-sm">
          <BarChart3 className="text-primary" size={28} />
          Seguimiento Grupal
        </h2>
        <p className="text-body-md font-medium text-on-surface-variant mt-xs">
          Monitorea el progreso académico de tus estudiantes por curso y sección.
        </p>
      </div>

      {/* Summary KPIs */}
      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-lg">
          {[
            {
              label: "Total Estudiantes",
              value: totalStudents,
              icon: <Users size={20} />,
              color: "text-primary bg-primary/10",
            },
            {
              label: "Total Tareas",
              value: totalTasks,
              icon: <FileText size={20} />,
              color: "text-tertiary bg-tertiary/10",
            },
            {
              label: "Completado Promedio",
              value: `${isNaN(avgCompletion) ? 0 : avgCompletion}%`,
              icon: <UserCheck size={20} />,
              color: "text-secondary bg-secondary/10",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant/30 shadow-sm flex items-center gap-md"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.color}`}
              >
                {kpi.icon}
              </div>
              <div>
                <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">
                  {kpi.label}
                </p>
                <p className="text-display-sm font-bold text-on-surface">
                  {kpi.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="space-y-lg">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 bg-surface-container-lowest rounded-2xl animate-pulse border border-outline-variant/30"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-error/10 border border-error/20 text-error p-lg rounded-xl flex items-center gap-md">
          <AlertCircle size={20} />
          <span className="text-label-md font-bold">{error}</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
          <GraduationCap size={48} className="opacity-30" />
          <div className="text-center">
            <p className="text-body-lg font-bold text-on-surface">
              Sin cursos asignados
            </p>
            <p className="text-body-md text-on-surface-variant mt-1">
              Aún no tienes cursos asignados. Contacta al administrador.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-xl">
          {groups.map((group) => (
            <CourseGroupPanel key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
