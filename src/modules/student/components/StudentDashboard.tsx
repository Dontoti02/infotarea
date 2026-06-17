"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  ClipboardList, 
  AlertCircle, 
  GraduationCap, 
  TrendingUp, 
  Clock, 
  ChevronRight, 
  CheckCircle2, 
  BookOpen,
  Bell,
  Loader2,
  FolderOpen
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function StudentDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [userName, setUserName] = useState<string>("Estudiante");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time data states
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [coursesCount, setCoursesCount] = useState<number>(0);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch student profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }

        // 2. Fetch course enrollments
        const { data: enrollments, error: enrollError } = await supabase
          .from("course_members")
          .select("course_id")
          .eq("profile_id", user.id);

        if (enrollError) throw enrollError;

        const courseIds = enrollments?.map((e: any) => e.course_id) || [];
        setCoursesCount(courseIds.length);

        if (courseIds.length > 0) {
          // 3. Fetch tasks for these courses
          const { data: tasksData, error: tasksError } = await supabase
            .from("tasks")
            .select(`
              *,
              courses (
                name,
                section
              )
            `)
            .in("course_id", courseIds)
            .order("due_date", { ascending: true });

          if (tasksError) throw tasksError;
          setTasks(tasksData || []);
        } else {
          setTasks([]);
        }

        // 4. Fetch submissions by this student
        const { data: subsData, error: subsError } = await supabase
          .from("submissions")
          .select("*")
          .eq("student_id", user.id);

        if (subsError) throw subsError;
        setSubmissions(subsData || []);

        // 5. Fetch recent notices (announcements)
        const { data: noticesData, error: noticesError } = await supabase
          .from("notices")
          .select(`
            *,
            profiles:author_id (
              full_name
            )
          `)
          .order("created_at", { ascending: false })
          .limit(3);

        if (noticesError) throw noticesError;
        setNotices(noticesData || []);

      } catch (err: any) {
        console.error("Error loading student dashboard:", err);
        setError(err.message || "Error al cargar la información del panel.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // calculations based on state
  const currentDateFormatted = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Capitalize first letter of weekday
  const capitalizedDate = currentDateFormatted.charAt(0).toUpperCase() + currentDateFormatted.slice(1);

  // 1. Tasks classifications
  const taskSubmissionsMap = new Map(submissions.map(s => [s.task_id, s]));
  
  const pendingTasksList = tasks.filter(task => {
    const sub = taskSubmissionsMap.get(task.id);
    return !sub; // No submission means pending
  });

  const pendingCount = pendingTasksList.length;

  // 2. Urgent tasks (due in next 48 hours and not submitted)
  const urgentTasksList = pendingTasksList.filter(task => {
    if (!task.due_date) return false;
    const now = new Date();
    const dueDate = new Date(task.due_date);
    const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 48;
  });

  const urgentCount = urgentTasksList.length;

  // 3. Average Grade
  const gradedSubmissions = submissions.filter(s => s.score !== null && s.score !== undefined);
  const averageGrade = gradedSubmissions.length > 0
    ? (gradedSubmissions.reduce((acc, s) => acc + Number(s.score), 0) / gradedSubmissions.length).toFixed(1)
    : null;

  // 4. Weekly progress metrics
  // Get start and end of current week (Monday - Sunday)
  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
  };

  const { startOfWeek, endOfWeek } = getWeekRange();

  const weeklyTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const date = new Date(t.due_date);
    return date >= startOfWeek && date <= endOfWeek;
  });

  const weeklySubmissions = weeklyTasks.filter(t => {
    const sub = taskSubmissionsMap.get(t.id);
    return !!sub;
  });

  const weeklyPercentage = weeklyTasks.length > 0
    ? Math.round((weeklySubmissions.length / weeklyTasks.length) * 100)
    : 100; // default 100% if no tasks this week

  // Top unsubmitted upcoming tasks
  const topUpcomingTasks = pendingTasksList.slice(0, 3).map(task => {
    let timeLabel = "Sin fecha límite";
    let isUrgent = false;

    if (task.due_date) {
      const now = new Date();
      const dueDate = new Date(task.due_date);
      const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      isUrgent = diffHours > 0 && diffHours <= 24;

      if (diffHours < 0) {
        timeLabel = "Vencida";
      } else if (dueDate.toDateString() === now.toDateString()) {
        timeLabel = `Hoy, ${dueDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
      } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        if (dueDate.toDateString() === tomorrow.toDateString()) {
          timeLabel = `Mañana, ${dueDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
        } else {
          timeLabel = dueDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        }
      }
    }

    return {
      id: task.id,
      name: task.title,
      subject: `${task.courses?.name || "Asignatura"} - ${task.courses?.section || ""}`,
      time: timeLabel,
      urgent: isUrgent,
    };
  });

  const kpis = [
    { 
      label: "Tareas Pendientes", 
      value: String(pendingCount), 
      icon: <ClipboardList size={20} />, 
      color: "bg-tertiary-container/10 text-tertiary", 
      sub: pendingCount === 0 ? "¡Estás al día!" : `${pendingCount} actividades por entregar.`, 
      subColor: pendingCount === 0 ? "text-secondary" : "text-surface-tint" 
    },
    { 
      label: "Próximas a Vencer", 
      value: String(urgentCount), 
      icon: <AlertCircle size={20} />, 
      color: "bg-error-container/20 text-error", 
      sub: urgentCount === 0 ? "Sin apuros en las próximas 48h." : `${urgentCount} vencen en las próximas 48h.`, 
      subColor: urgentCount === 0 ? "text-on-surface-variant" : "text-error font-bold" 
    },
    { 
      label: "Promedio Calificación", 
      value: averageGrade !== null ? averageGrade : "--", 
      icon: <GraduationCap size={20} />, 
      color: "bg-primary/10 text-primary", 
      sub: averageGrade === null ? "Sin calificaciones registradas" : Number(averageGrade) >= 70 ? "Excelente rendimiento global." : "Sigue esforzándote.", 
      subColor: "text-on-surface-variant" 
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={44} />
          <p className="text-body-md text-on-surface-variant font-bold">Cargando tu panel académico...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 border border-error/20 text-error p-lg rounded-2xl flex items-center gap-md max-w-2xl mx-auto shadow-sm">
        <AlertCircle size={28} className="shrink-0" />
        <div>
          <h4 className="text-title-md font-bold">Error en la carga</h4>
          <p className="text-body-md mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-xl animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Hola, {userName} 👋</h2>
          <p className="text-body-lg font-medium text-on-surface-variant mt-1">
            {coursesCount === 0 
              ? "Aún no estás inscrito en ningún curso. Contacta a administración." 
              : `Aquí tienes un resumen de tu actividad académica para hoy.`}
          </p>
        </div>
        <div className="flex items-center gap-sm bg-surface-container-lowest px-md py-sm rounded-full border border-outline-variant shadow-sm text-label-md font-bold text-on-surface-variant">
          <CalendarIcon size={18} className="text-primary" />
          <span>{capitalizedDate}</span>
        </div>
      </div>

      {coursesCount > 0 ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md md:gap-lg">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-surface-container-lowest p-lg rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30 flex flex-col justify-between h-40">
                <div className="flex justify-between items-start">
                  <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">{kpi.label}</span>
                  <div className={`${kpi.color} p-1.5 rounded-xl flex items-center justify-center border border-outline-variant/10 shadow-inner`}>
                    {kpi.icon}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-md">
                  <span className="text-display-md font-black text-on-surface leading-none">{kpi.value}</span>
                </div>
                <div className="mt-sm pt-sm border-t border-outline-variant/20">
                  <span className={`text-label-sm font-bold ${kpi.subColor}`}>{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            {/* Left: Tasks list */}
            <div className="lg:col-span-8 flex flex-col gap-md">
              <div className="flex justify-between items-center">
                <h3 className="text-title-lg font-bold text-on-surface">Tareas Próximas Pendientes</h3>
                <Link href="/student/tareas" className="text-label-md font-bold text-primary hover:underline transition-all">
                  Ver todas
                </Link>
              </div>
              
              {topUpcomingTasks.length === 0 ? (
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center gap-3">
                  <CheckCircle2 size={44} className="text-secondary" />
                  <p className="text-body-lg font-bold text-on-surface">¡Todas las tareas entregadas!</p>
                  <p className="text-body-md text-on-surface-variant">Estás al día con tus asignaturas. Buen trabajo.</p>
                </div>
              ) : (
                <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col divide-y divide-outline-variant/50">
                  {topUpcomingTasks.map((task) => (
                    <div key={task.id} className="p-md hover:bg-surface-container-low/30 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-sm group">
                      <div className="flex items-start gap-md">
                        <div className={`p-2 rounded-xl mt-1 shrink-0 ${task.urgent ? 'bg-error-container/20 text-error' : 'bg-primary/10 text-primary'}`}>
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <h4 className="text-label-md font-bold text-on-surface group-hover:text-primary transition-colors leading-snug">{task.name}</h4>
                          <p className="text-body-md font-medium text-on-surface-variant mt-0.5">{task.subject}</p>
                          <div className={`flex items-center gap-xs mt-1.5 font-bold text-label-sm ${task.urgent ? 'text-error animate-pulse' : 'text-on-surface-variant'}`}>
                            <Clock size={14} />
                            <span>{task.time}</span>
                          </div>
                        </div>
                      </div>
                      <Link 
                        href="/student/tareas"
                        className={`px-lg py-2.5 rounded-xl font-bold text-label-md transition-all w-full sm:w-auto text-center shadow-sm ${
                          task.urgent 
                            ? 'bg-primary text-on-primary hover:bg-primary-container' 
                            : 'border border-outline text-on-surface-variant hover:bg-surface-container-low'
                        }`}
                      >
                        Ver Detalle
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Progress & Announcements */}
            <div className="lg:col-span-4 flex flex-col gap-lg">
              {/* Weekly Progress */}
              <div className="bg-surface-container-lowest p-lg rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col">
                <h3 className="text-title-md font-bold text-on-surface mb-sm">Progreso de la Semana</h3>
                <div className="flex items-center justify-center py-md relative">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-surface-container-high, #f5f5f5)" strokeWidth="8"></circle>
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      fill="transparent" 
                      stroke="var(--color-primary, #6750A4)" 
                      strokeWidth="8" 
                      strokeDasharray="251.2" 
                      strokeDashoffset={251.2 - (251.2 * weeklyPercentage) / 100} 
                      strokeLinecap="round" 
                      className="transition-all duration-1000"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-headline-md font-black text-on-surface">{weeklyPercentage}%</span>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Entregado</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-sm pt-sm border-t border-outline-variant/20">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Tareas</p>
                    <p className="text-label-md font-black text-on-surface mt-0.5">{weeklyTasks.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Listas</p>
                    <p className="text-label-md font-black text-primary mt-0.5">{weeklySubmissions.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Pend.</p>
                    <p className="text-label-md font-black text-error mt-0.5">{weeklyTasks.length - weeklySubmissions.length}</p>
                  </div>
                </div>
              </div>

              {/* School Notices */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col overflow-hidden">
                <div className="p-md border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/20">
                  <h3 className="text-title-md font-bold text-on-surface">Tablón de Avisos</h3>
                  <Bell size={18} className="text-primary animate-bounce" />
                </div>
                <div className="divide-y divide-outline-variant/35 flex-1">
                  {notices.length === 0 ? (
                    <div className="p-md text-center text-on-surface-variant italic">
                      No hay avisos recientes publicados.
                    </div>
                  ) : (
                    notices.map((notice) => {
                      const ageHours = Math.round((new Date().getTime() - new Date(notice.created_at).getTime()) / (1000 * 60 * 60));
                      let ageLabel = "Hace unas horas";
                      if (ageHours >= 24) {
                        ageLabel = `Hace ${Math.round(ageHours / 24)}d`;
                      } else if (ageHours > 0) {
                        ageLabel = `Hace ${ageHours}h`;
                      }

                      return (
                        <div key={notice.id} className="p-md hover:bg-surface-container-low/30 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                              notice.category === "urgent" 
                                ? "bg-error-container/20 text-error" 
                                : notice.category === "event" 
                                  ? "bg-amber-100 text-amber-800" 
                                  : "bg-primary/10 text-primary"
                            }`}>
                              {notice.category === "urgent" ? "Urgente" : notice.category === "event" ? "Evento" : "Académico"}
                            </span>
                            <span className="text-[10px] font-bold text-on-surface-variant">{ageLabel}</span>
                          </div>
                          <h4 className="text-label-md font-bold text-on-surface mb-0.5">{notice.title}</h4>
                          <p className="text-body-md font-medium text-on-surface-variant line-clamp-2 leading-relaxed">{notice.content}</p>
                          <span className="text-[10px] font-bold text-primary mt-1 block">Por: {notice.profiles?.full_name || "Docente"}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-3 text-center border-t border-outline-variant/20 bg-surface-container-low/10">
                  <Link href="/student/avisos" className="text-label-sm font-bold text-primary hover:underline transition-all">
                    Ver Tablón Completo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-16 text-center shadow-sm max-w-2xl mx-auto flex flex-col items-center gap-4">
          <BookOpen size={48} className="text-outline-variant" />
          <h3 className="text-title-lg font-bold text-on-surface">Bienvenido al Ciclo Escolar</h3>
          <p className="text-body-md text-on-surface-variant">
            Actualmente no estás asignado a ninguna asignatura o curso. Pide al administrador que te matricule en tus cursos correspondientes para que puedas ver tus tareas, notas y avisos escolares aquí.
          </p>
        </div>
      )}
    </div>
  );
}
