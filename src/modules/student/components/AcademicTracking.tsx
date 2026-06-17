"use client";

import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Calendar, 
  MessageSquare, 
  Download, 
  TrendingUp, 
  Star, 
  Info, 
  CheckCircle2, 
  Trophy, 
  CalendarCheck,
  Loader2,
  AlertCircle,
  Clock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AcademicTracking() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalTasks: 0,
    deliveredTasks: 0,
    averageGrade: "--",
    weeklyDeliveries: 0,
    percentileLabel: "Estudiante Regular"
  });
  const [coursePerformance, setCoursePerformance] = useState<any[]>([]);
  const [latestGrades, setLatestGrades] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function loadAcademicData() {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch profile details
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileErr) throw profileErr;
        setStudentProfile({
          ...profile,
          email: user.email,
          createdAt: new Date(profile.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "long" })
        });

        // 2. Fetch course enrollments
        const { data: enrollments, error: enrollErr } = await supabase
          .from("course_members")
          .select(`
            course_id,
            courses (
              id,
              name,
              section
            )
          `)
          .eq("profile_id", user.id);

        if (enrollErr) throw enrollErr;

        const enrolledCourses = enrollments?.map((e: any) => e.courses).filter(Boolean) || [];
        const courseIds = enrolledCourses.map((c: any) => c.id);

        if (courseIds.length === 0) {
          setLoading(false);
          return;
        }

        // Get unique section/grade labels
        const uniqueSections = [...new Set(enrolledCourses.map((c: any) => c.section).filter(Boolean))];
        const formatSection = (sec: string) => {
          const gradeMatch = sec.match(/[1-5]/);
          const sectionMatch = sec.match(/[A-G]/i);
          if (gradeMatch && sectionMatch) {
            return `${gradeMatch[0]}° Grado "${sectionMatch[0].toUpperCase()}"`;
          }
          return sec;
        };
        const sectionsLabel = uniqueSections.length > 0
          ? uniqueSections.map(s => formatSection(s as string)).join(", ")
          : "Sin sección asignada";

        setStudentProfile((prev: any) => ({
          ...prev,
          sectionsLabel
        }));

        // 3. Fetch tasks for these courses
        const { data: tasks, error: tasksErr } = await supabase
          .from("tasks")
          .select("id, title, due_date, course_id, created_at")
          .in("course_id", courseIds);

        if (tasksErr) throw tasksErr;

        // 4. Fetch submissions by student
        const { data: submissions, error: subsErr } = await supabase
          .from("submissions")
          .select("*, tasks (title, course_id, courses (name))")
          .eq("student_id", user.id);

        if (subsErr) throw subsErr;

        const totalTasksCount = tasks?.length || 0;
        const deliveredCount = submissions?.length || 0;

        // Average Grade calculation
        const gradedSubmissions = submissions?.filter(s => s.score !== null && s.score !== undefined) || [];
        const avg = gradedSubmissions.length > 0
          ? (gradedSubmissions.reduce((acc, s) => acc + Number(s.score), 0) / gradedSubmissions.length).toFixed(1)
          : "--";

        // Weekly submissions (submissions in past 7 days)
        const pastWeek = new Date();
        pastWeek.setDate(pastWeek.getDate() - 7);
        const weeklyCount = submissions?.filter(s => new Date(s.created_at) >= pastWeek).length || 0;

        // Set percentile label based on average grade
        let percentile = "Estudiante Constante";
        if (avg !== "--") {
          const numericAvg = Number(avg);
          if (numericAvg >= 90) percentile = "Rendimiento Sobresaliente (Top 10%)";
          else if (numericAvg >= 80) percentile = "Rendimiento Destacado (Top 25%)";
          else if (numericAvg >= 70) percentile = "Buen Rendimiento Académico";
        }

        setStats({
          totalTasks: totalTasksCount,
          deliveredTasks: deliveredCount,
          averageGrade: avg,
          weeklyDeliveries: weeklyCount,
          percentileLabel: percentile
        });

        // 5. Course performance list
        const performance = enrolledCourses.map((course: any) => {
          const courseTasks = tasks?.filter(t => t.course_id === course.id) || [];
          const courseTasksCount = courseTasks.length;
          const courseSubmissions = submissions?.filter(s => s.tasks?.course_id === course.id) || [];
          const courseDeliveredCount = courseSubmissions.length;

          // Completion rate
          const progress = courseTasksCount > 0
            ? Math.round((courseDeliveredCount / courseTasksCount) * 100)
            : 100; // 100% default if no tasks

          let color = "bg-primary";
          if (progress >= 90) color = "bg-teal-500";
          else if (progress >= 75) color = "bg-primary";
          else if (progress >= 50) color = "bg-amber-500";
          else color = "bg-rose-500";

          return {
            name: course.name,
            progress,
            color,
            tasksCount: courseTasksCount,
            deliveredCount: courseDeliveredCount
          };
        });
        setCoursePerformance(performance);

        // 6. Latest grades/submissions
        const sortedSubmissions = [...(submissions || [])].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 5);

        const latest = sortedSubmissions.map((s: any) => {
          let gradeStr = "-";
          let statusLabel = "Entregado";
          if (s.status === "reviewed") {
            gradeStr = s.score !== null && s.score !== undefined ? Number(s.score).toFixed(1) : "-";
            statusLabel = "Revisado";
          }

          return {
            activity: s.tasks?.title || "Actividad sin título",
            subject: s.tasks?.courses?.name || "Curso",
            date: new Date(s.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
            grade: gradeStr,
            status: statusLabel
          };
        });
        setLatestGrades(latest);

      } catch (err: any) {
        console.error("Error fetching academic tracking info:", err);
        setError(err.message || "Error al cargar la información de seguimiento académico.");
      } finally {
        setLoading(false);
      }
    }

    loadAcademicData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={44} />
          <p className="text-body-md text-on-surface-variant font-bold">Cargando tu progreso académico...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 border border-error/20 text-error p-lg rounded-2xl flex items-center gap-md max-w-2xl mx-auto shadow-sm">
        <AlertCircle size={28} className="shrink-0" />
        <div>
          <h4 className="text-title-md font-bold">Error de carga</h4>
          <p className="text-body-md mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const completionPercentage = stats.totalTasks > 0
    ? Math.round((stats.deliveredTasks / stats.totalTasks) * 100)
    : 100;

  return (
    <div className="space-y-lg animate-fade-in">
      {/* Student Profile Header Card */}
      {studentProfile && (
        <div className="bg-surface rounded-xl shadow-sm p-lg flex flex-col md:flex-row items-center md:items-start gap-lg relative overflow-hidden border border-outline-variant/30">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="w-24 h-24 rounded-full bg-primary-container text-primary font-black text-display-sm flex items-center justify-center border-4 border-surface shadow-sm z-10 shrink-0">
            {studentProfile.full_name?.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 z-10 text-center md:text-left min-w-0">
            <h2 className="text-headline-lg font-bold text-on-surface truncate">{studentProfile.full_name}</h2>
            <p className="text-body-lg text-on-surface-variant mt-xs font-semibold">{studentProfile.sectionsLabel}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-md mt-md">
              <span className="inline-flex items-center gap-xs px-3 py-1.5 bg-surface-container-low text-primary font-bold text-label-md rounded-lg border border-outline-variant/40">
                <Mail size={16} /> {studentProfile.email}
              </span>
              <span className="inline-flex items-center gap-xs px-3 py-1.5 bg-surface-container-low text-primary font-bold text-label-md rounded-lg border border-outline-variant/40">
                <Calendar size={16} /> Ingreso: {studentProfile.createdAt}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        <div className="bg-surface rounded-xl shadow-sm p-lg flex flex-col hover:shadow-md transition-shadow border border-outline-variant/30 h-40 justify-between">
          <div className="flex items-center gap-sm">
            <div className="p-sm bg-secondary-container/20 rounded-xl flex items-center justify-center border border-outline-variant/10">
              <CheckCircle2 className="text-secondary" size={20} />
            </div>
            <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Tareas Entregadas</span>
          </div>
          <div className="mt-md">
            <div className="flex items-baseline gap-xs">
              <span className="text-display-md font-black text-on-surface leading-none">{stats.deliveredTasks}</span>
              <span className="text-title-sm font-bold text-on-surface-variant">/ {stats.totalTasks}</span>
            </div>
            <div className="mt-sm flex items-center gap-xs text-secondary font-bold text-label-sm">
              <TrendingUp size={14} /> <span>+{stats.weeklyDeliveries} entregadas esta semana</span>
            </div>
          </div>
        </div>
        
        <div className="bg-surface rounded-xl shadow-sm p-lg flex flex-col hover:shadow-md transition-shadow border border-outline-variant/30 h-40 justify-between">
          <div className="flex items-center gap-sm">
            <div className="p-sm bg-primary/10 rounded-xl flex items-center justify-center border border-outline-variant/10">
              <Trophy className="text-primary" size={20} />
            </div>
            <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Promedio General</span>
          </div>
          <div className="mt-md">
            <div className="flex items-baseline gap-xs">
              <span className="text-display-md font-black text-on-surface leading-none">{stats.averageGrade}</span>
              {stats.averageGrade !== "--" && <span className="text-title-sm font-bold text-on-surface-variant">/ 100</span>}
            </div>
            <div className="mt-sm flex items-center gap-xs text-primary font-bold text-label-sm">
              <Star size={14} /> <span>{stats.percentileLabel}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl shadow-sm p-lg flex flex-col hover:shadow-md transition-shadow border border-outline-variant/30 h-40 justify-between">
          <div className="flex items-center gap-sm">
            <div className="p-sm bg-tertiary/10 rounded-xl flex items-center justify-center border border-outline-variant/10">
              <CalendarCheck className="text-tertiary" size={20} />
            </div>
            <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Asistencia a Cursos</span>
          </div>
          <div className="mt-md">
            <div className="flex items-baseline gap-xs">
              <span className="text-display-md font-black text-on-surface leading-none">100%</span>
            </div>
            <div className="mt-sm flex items-center gap-xs text-on-surface-variant font-bold text-label-sm">
              <Info size={14} /> <span>Actualmente matriculado y al corriente</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Compliance Circle Chart */}
        <div className="bg-surface rounded-xl shadow-sm p-lg flex flex-col items-center justify-center col-span-1 min-h-[320px] border border-outline-variant/30">
          <h3 className="text-title-md font-bold text-on-surface mb-lg text-center uppercase tracking-wider">Cumplimiento de Tareas</h3>
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-surface-container-high, #f3f3f3)" strokeWidth="3"></circle>
              <circle 
                cx="18" 
                cy="18" 
                r="15.9155" 
                fill="none" 
                stroke="var(--color-primary, #6750A4)" 
                strokeWidth="3" 
                strokeDasharray={`${completionPercentage}, 100`} 
                strokeLinecap="round"
                className="transition-all duration-1000"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-headline-lg font-black text-primary">{completionPercentage}%</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Completado</span>
            </div>
          </div>
          <p className="text-body-md text-on-surface-variant mt-lg text-center max-w-[220px] font-medium leading-relaxed">
            {completionPercentage >= 90 
              ? "¡Excelente ritmo de trabajo! Sigue entregando a tiempo tus actividades." 
              : completionPercentage >= 70 
                ? "Vas por buen camino. Trata de entregar tus actividades pendientes para subir el promedio."
                : "Tienes varias entregas pendientes. Te recomendamos revisar tu listado de tareas."}
          </p>
        </div>

        {/* Progress Bars */}
        <div className="bg-surface rounded-xl shadow-sm p-lg col-span-1 lg:col-span-2 flex flex-col border border-outline-variant/30">
          <div className="flex justify-between items-center mb-lg">
            <h3 className="text-title-md font-bold text-on-surface uppercase tracking-wider">Avance por Materia</h3>
          </div>
          
          {coursePerformance.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant italic">
              Sin materias inscritas.
            </div>
          ) : (
            <div className="flex flex-col gap-md flex-1 justify-center">
              {coursePerformance.map((s) => (
                <div key={s.name} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-label-md font-bold text-on-surface truncate max-w-[70%]">{s.name}</span>
                    <span className="text-label-sm font-bold text-on-surface-variant">
                      {s.deliveredCount}/{s.tasksCount} entregadas ({s.progress}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden border border-outline-variant/10">
                    <div className={`${s.color} h-full rounded-full transition-all duration-1000`} style={{ width: `${s.progress}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grades Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="p-lg border-b border-outline-variant">
          <h3 className="text-title-md font-bold text-on-surface uppercase tracking-wider">Últimas Calificaciones y Entregas</h3>
        </div>
        <div className="overflow-x-auto">
          {latestGrades.length === 0 ? (
            <div className="p-lg text-center text-on-surface-variant italic">
              No tienes entregas registradas todavía. Las últimas actividades que califiquen aparecerán aquí.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="p-md text-label-md font-bold text-on-surface-variant uppercase">Actividad</th>
                  <th className="p-md text-label-md font-bold text-on-surface-variant uppercase">Asignatura</th>
                  <th className="p-md text-label-md font-bold text-on-surface-variant uppercase">Fecha de Entrega</th>
                  <th className="p-md text-label-md font-bold text-on-surface-variant uppercase text-right">Nota</th>
                  <th className="p-md text-label-md font-bold text-on-surface-variant uppercase text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="text-body-md text-on-surface">
                {latestGrades.map((g, i) => (
                  <tr key={i} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low/30 transition-colors">
                    <td className="p-md font-bold text-on-surface">{g.activity}</td>
                    <td className="p-md text-on-surface-variant font-medium">{g.subject}</td>
                    <td className="p-md text-on-surface-variant font-medium">{g.date}</td>
                    <td className="p-md text-right font-black text-primary">{g.grade}</td>
                    <td className="p-md text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-label-sm font-bold ${
                        g.status === 'Revisado' 
                          ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/20 dark:text-teal-300 dark:border-teal-900' 
                          : 'bg-secondary-container text-on-secondary-container border border-secondary/20'
                      }`}>
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
