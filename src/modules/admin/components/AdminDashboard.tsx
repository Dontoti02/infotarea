"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  School, 
  UserCircle, 
  BookOpen, 
  ClipboardList,
  Megaphone, 
  Calendar, 
  UserPlus,
  Library,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  History,
  Loader2,
  RefreshCw
} from "lucide-react";
import { fetchAdminDashboardData, AdminDashboardData } from "../services/dashboardService";

const defaultData: AdminDashboardData = {
  totalUsers: 0,
  totalTeachers: 0,
  totalStudents: 0,
  totalCourses: 0,
  activeTasks: 0,
  totalNotices: 0,
  weeklyActivity: [],
  studentsPerCourse: [],
  usersByRole: [],
  recentActivity: [],
  todayDate: "",
  adminName: "Admin",
};

/** Color por rol para el donut y su leyenda. */
const ROLE_COLORS: Record<string, { ring: string; dot: string }> = {
  student: { ring: "stroke-primary", dot: "bg-primary" },
  teacher: { ring: "stroke-secondary", dot: "bg-secondary" },
  parent: { ring: "stroke-violet-400", dot: "bg-violet-400" },
  admin: { ring: "stroke-indigo-400", dot: "bg-indigo-400" },
};

/** Rounds a value up to a clean 1/2/5/10 step so the chart axis shows whole numbers. */
function niceChartStep(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  for (const factor of [1, 2, 5, 10]) {
    if (factor * magnitude >= value) return factor * magnitude;
  }
  return 10 * magnitude;
}

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminDashboardData();
      setData(result);
    } catch (err: any) {
      console.error("Error loading admin dashboard data:", err);
      setError(err.message || "Error al cargar datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Chart scaling — axis always ends on a whole number
  const rawMaxChartVal = data.weeklyActivity.reduce(
    (max, d) => Math.max(max, d.submissions, d.created),
    0
  );
  const chartStep = niceChartStep(rawMaxChartVal / 4);
  const maxChartVal = chartStep * 4;
  const hasChartData = rawMaxChartVal > 0;

  // Matrículas por curso (barras horizontales)
  const maxCourseStudents = data.studentsPerCourse.reduce((max, c) => Math.max(max, c.students), 0);
  const totalMemberships = data.studentsPerCourse.reduce((sum, c) => sum + c.students, 0);
  const emptyCourses = data.studentsPerCourse.filter((c) => c.students === 0).length;

  // Usuarios por rol (donut): porcentaje y desplazamiento de cada segmento
  const totalUsersByRole = data.usersByRole.reduce((sum, r) => sum + r.count, 0);
  const roleSegments = data.usersByRole.reduce<{
    role: string;
    label: string;
    count: number;
    pct: number;
    offset: number;
    colors: { ring: string; dot: string };
  }[]>((segments, role) => {
    const pct = totalUsersByRole > 0 ? (role.count / totalUsersByRole) * 100 : 0;
    const previous = segments[segments.length - 1];
    return [
      ...segments,
      {
        ...role,
        pct,
        offset: previous ? previous.offset + previous.pct : 0,
        colors: ROLE_COLORS[role.role] ?? { ring: "stroke-outline", dot: "bg-outline" },
      },
    ];
  }, []);

  const kpis = [
    { label: "Total Usuarios", value: data.totalUsers.toLocaleString(), icon: <Users size={20} />, color: "bg-secondary-container/50 text-secondary", route: "/admin/usuarios" },
    { label: "Docentes", value: data.totalTeachers.toLocaleString(), icon: <School size={20} />, color: "bg-secondary-container/50 text-secondary", route: "/admin/usuarios" },
    { label: "Estudiantes", value: data.totalStudents.toLocaleString(), icon: <UserCircle size={20} />, color: "bg-secondary-container/50 text-secondary", route: "/admin/usuarios" },
    { label: "Cursos", value: data.totalCourses.toLocaleString(), icon: <BookOpen size={20} />, color: "bg-secondary-container/50 text-secondary", route: "/admin/cursos" },
    { label: "Tareas", value: data.activeTasks.toLocaleString(), icon: <ClipboardList size={20} />, color: "bg-secondary-container/50 text-secondary", route: "/admin/tareas" },
    { label: "Avisos", value: data.totalNotices.toLocaleString(), icon: <Megaphone size={20} />, color: "bg-secondary-container/50 text-secondary", route: "/admin/avisos" },
  ];

  const actionIcons: Record<string, React.ReactNode> = {
    user: <UserCircle size={18} />,
    course: <BookOpen size={18} />,
    notice: <Megaphone size={18} />,
    submission: <CheckCircle2 size={18} />,
    task: <ClipboardList size={18} />,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-primary animate-spin" />
          <p className="text-body-lg font-bold text-on-surface-variant">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 bg-error-container/20 p-xl rounded-xl border border-error">
          <AlertCircle size={48} className="text-error" />
          <p className="text-body-lg font-bold text-error">Error al cargar datos</p>
          <p className="text-body-md text-on-surface-variant">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 px-6 py-2 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary-container transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface mb-xs">Dashboard General</h2>
          <p className="text-body-md font-medium text-on-surface-variant">
            Bienvenido, {data.adminName}. Resumen de actividad y gestión académica.
          </p>
        </div>
        <div className="hidden sm:flex text-label-sm font-bold text-outline gap-2 items-center">
          <Calendar size={16} />
          <span>{data.todayDate}</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md md:gap-lg">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => router.push(kpi.route)}
            className="bg-surface rounded-xl p-lg shadow-sm border border-outline-variant/30 flex flex-col gap-sm hover:shadow-md transition-all hover:border-primary/30 text-left cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <span className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">{kpi.label}</span>
              <div className={`${kpi.color} p-2 rounded-full flex items-center justify-center`}>
                {kpi.icon}
              </div>
            </div>
            <span className="text-headline-md font-bold text-on-surface">{kpi.value}</span>
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Left: Chart & Quick Actions */}
        <div className="lg:col-span-8 space-y-lg flex flex-col">
          {/* Weekly Activity Chart */}
          <div className="bg-surface rounded-xl p-lg shadow-sm border border-outline-variant/30 flex-1 min-h-[350px] flex flex-col">
            <div className="flex justify-between items-center mb-xl">
              <h3 className="text-title-lg font-bold text-on-surface">Actividad semanal</h3>
              <button
                onClick={loadData}
                className="p-2 hover:bg-surface-container rounded-full text-outline transition-colors"
                title="Actualizar"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {!hasChartData ? (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant">
                <p className="text-body-md font-medium">No hay datos de actividad esta semana</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Legend */}
                <div className="flex items-center gap-4 mb-3 text-label-sm text-on-surface-variant">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-primary" />
                    <span>Entregas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-primary/30" />
                    <span>Registros</span>
                  </div>
                </div>
                <div className="flex-1 flex items-end gap-sm md:gap-md pt-lg border-b border-outline-variant/50 relative">
                  <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-outline font-bold text-[10px] pb-8 uppercase">
                    {[4, 3, 2, 1, 0].map((tick) => (
                      <span key={tick}>{chartStep * tick}</span>
                    ))}
                  </div>
                  <div className="flex-1 flex justify-around items-end h-full pl-8 pb-2">
                    {data.weeklyActivity.map((d) => {
                      const subPct = maxChartVal > 0 ? (d.submissions / maxChartVal) * 100 : 0;
                      const crePct = maxChartVal > 0 ? (d.created / maxChartVal) * 100 : 0;
                      return (
                        <div key={d.day} className="flex flex-col items-center gap-2 group w-full px-1 max-w-[40px]">
                          <div className="w-full bg-primary/10 rounded-t-sm h-32 relative overflow-hidden">
                            <div
                              className="absolute bottom-0 w-full bg-primary/30 rounded-t-sm transition-all"
                              style={{ height: `${crePct}%` }}
                            />
                            <div
                              className="absolute bottom-0 w-full bg-primary rounded-t-sm transition-all group-hover:bg-primary/80"
                              style={{ height: `${subPct}%` }}
                            />
                          </div>
                          <span className="text-label-sm font-bold text-on-surface-variant uppercase">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Access */}
          <div className="bg-surface rounded-xl p-lg shadow-sm border border-outline-variant/30">
            <h3 className="text-title-lg font-bold text-on-surface mb-lg">Accesos Rápidos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              <button
                onClick={() => router.push("/admin/usuarios")}
                className="bg-primary text-on-primary rounded-lg p-md flex items-center justify-center gap-sm font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm cursor-pointer"
              >
                <UserPlus size={18} /> + Crear Usuario
              </button>
              <button
                onClick={() => router.push("/admin/cursos")}
                className="bg-surface border border-primary text-primary rounded-lg p-md flex items-center justify-center gap-sm font-bold text-label-md hover:bg-surface-container-low transition-colors shadow-sm cursor-pointer"
              >
                <Library size={18} /> + Nuevo Curso
              </button>
              <button
                onClick={() => router.push("/admin/avisos")}
                className="bg-surface border border-secondary text-secondary rounded-lg p-md flex items-center justify-center gap-sm font-bold text-label-md hover:bg-secondary-container/20 transition-colors shadow-sm cursor-pointer"
              >
                <AlertCircle size={18} /> + Publicar Aviso
              </button>
            </div>
          </div>
        </div>

        {/* Right: Recent Activity */}
        <div className="lg:col-span-4 bg-surface rounded-xl p-lg shadow-sm border border-outline-variant/30 flex flex-col h-full">
          <div className="flex justify-between items-center mb-lg">
            <h3 className="text-title-lg font-bold text-on-surface">Actividad Reciente</h3>
            <button
              onClick={() => router.push("/admin/seguimiento")}
              className="text-label-md font-bold text-primary hover:underline transition-all cursor-pointer"
            >
              Ver todo
            </button>
          </div>
          {data.recentActivity.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-on-surface-variant">
              <div className="text-center">
                <History size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-body-md font-medium">No hay actividad reciente</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between pb-4 border-b border-outline-variant/30 last:border-0 last:pb-0 group cursor-pointer hover:bg-surface-container-low/30 rounded-lg p-2 -m-2 transition-colors"
                >
                  <div className="flex items-center gap-sm">
                    <div className="bg-surface-container-high p-2 rounded-full text-on-surface-variant group-hover:text-primary transition-colors">
                      {actionIcons[act.type] || <Clock size={18} />}
                    </div>
                    <div>
                      <p className="text-on-surface font-bold text-body-md">{act.action}</p>
                      <p className="text-label-sm font-medium text-outline">{act.details}</p>
                    </div>
                  </div>
                  <span className="text-label-sm font-bold text-outline whitespace-nowrap">{act.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gráficos adicionales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">

        {/* Estudiantes por curso */}
        <div className="bg-surface rounded-xl p-lg shadow-sm border border-outline-variant/30 flex flex-col">
          <div className="flex justify-between items-start gap-md mb-lg">
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">Estudiantes por curso</h3>
              <p className="text-label-sm font-medium text-on-surface-variant mt-1">
                Matrículas registradas en cada curso.
              </p>
            </div>
            <span className="text-label-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full whitespace-nowrap">
              {totalMemberships} matrículas
            </span>
          </div>

          {data.studentsPerCourse.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-xl text-on-surface-variant">
              <div className="text-center">
                <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-body-md font-medium">No hay cursos registrados</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center">
              <div className="space-y-md">
                {data.studentsPerCourse.map((course) => {
                  const pct = maxCourseStudents > 0 ? (course.students / maxCourseStudents) * 100 : 0;
                  const isEmpty = course.students === 0;
                  return (
                    <div key={course.id}>
                      <div className="flex items-center justify-between gap-sm mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-label-md font-bold text-on-surface truncate" title={course.name}>
                            {course.name}
                          </span>
                          {course.section && (
                            <span className="text-[10px] font-bold bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded-full shrink-0">
                              {course.section}
                            </span>
                          )}
                        </div>
                        <span className={`text-label-md font-bold tabular-nums shrink-0 ${isEmpty ? "text-amber-600 dark:text-amber-300" : "text-on-surface"}`}>
                          {isEmpty ? "Sin estudiantes" : course.students}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isEmpty ? "" : "bg-gradient-to-r from-primary to-primary-container"}`}
                          style={{ width: `${isEmpty ? 0 : Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {emptyCourses > 0 && (
                <p className="mt-lg flex items-center gap-1.5 text-label-sm font-bold text-amber-600 dark:text-amber-300">
                  <AlertTriangle size={14} />
                  {emptyCourses === 1
                    ? "1 curso no tiene estudiantes asignados"
                    : `${emptyCourses} cursos no tienen estudiantes asignados`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Usuarios por rol */}
        <div className="bg-surface rounded-xl p-lg shadow-sm border border-outline-variant/30 flex flex-col">
          <div className="mb-lg">
            <h3 className="text-title-lg font-bold text-on-surface">Usuarios por rol</h3>
            <p className="text-label-sm font-medium text-on-surface-variant mt-1">
              Composición de la comunidad educativa.
            </p>
          </div>

          {data.usersByRole.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-xl text-on-surface-variant">
              <div className="text-center">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-body-md font-medium">No hay usuarios registrados</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-xl">
              <div className="relative w-40 h-40 shrink-0">
                <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
                  <circle
                    cx="21" cy="21" r="15.9155" fill="none" strokeWidth="6"
                    className="stroke-surface-container-high"
                  />
                  {roleSegments.map((segment) => (
                    <circle
                      key={segment.role}
                      cx="21" cy="21" r="15.9155" fill="none" strokeWidth="6"
                      pathLength={100}
                      strokeDasharray={`${segment.pct} ${100 - segment.pct}`}
                      strokeDashoffset={-segment.offset}
                      className={`${segment.colors.ring} transition-all`}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-headline-md font-bold text-on-surface tabular-nums">{totalUsersByRole}</span>
                  <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Usuarios</span>
                </div>
              </div>

              <div className="w-full sm:w-auto flex-1 space-y-sm">
                {roleSegments.map((segment) => (
                  <div key={segment.role} className="flex items-center justify-between gap-sm">
                    <div className="flex items-center gap-sm min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${segment.colors.dot}`} />
                      <span className="text-label-md font-bold text-on-surface truncate">{segment.label}</span>
                    </div>
                    <div className="flex items-baseline gap-xs shrink-0">
                      <span className="text-label-md font-bold text-on-surface tabular-nums">{segment.count}</span>
                      <span className="text-label-sm font-medium text-on-surface-variant tabular-nums">
                        ({segment.pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}