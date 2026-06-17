"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  School, 
  UserCircle, 
  BookOpen, 
  FileText,
  ClipboardList,
  Megaphone, 
  Calendar, 
  MoreVertical,
  UserPlus,
  Library,
  AlertCircle,
  Clock,
  CheckCircle2,
  Settings,
  History,
  TrendingUp,
  GraduationCap,
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
  recentActivity: [],
  todayDate: "",
  adminName: "Admin",
};

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

  // Find max for the chart scaling
  const maxChartVal = Math.max(
    1,
    ...data.weeklyActivity.map((d) => Math.max(d.submissions, d.created))
  );

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

            {data.weeklyActivity.length === 0 ? (
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
                    <span>{maxChartVal}</span>
                    <span>{Math.round(maxChartVal * 0.75)}</span>
                    <span>{Math.round(maxChartVal * 0.5)}</span>
                    <span>{Math.round(maxChartVal * 0.25)}</span>
                    <span>0</span>
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
    </div>
  );
}