"use client";

import { AdminLayout } from "@/modules/admin/components/AdminLayout";
import { 
  Bell, 
  CheckCheck, 
  Clock, 
  Megaphone, 
  UserCircle, 
  ClipboardList,
  AlertCircle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  icon: React.ReactNode;
  color: string;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs} hora${diffHrs !== 1 ? "s" : ""}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Fetch recent notices, tasks, and users to build notifications
      const [notices, tasks, users] = await Promise.all([
        supabase
          .from("notices")
          .select("id, title, created_at, category")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("tasks")
          .select("id, title, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("profiles")
          .select("id, full_name, role, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const all: Notification[] = [];

      // Notices
      (notices.data ?? []).forEach((n) => {
        const isUrgent = n.category === "urgent";
        all.push({
          id: `notice-${n.id}`,
          title: isUrgent ? "🔴 Aviso urgente" : "📢 Nuevo aviso",
          description: n.title,
          time: getRelativeTime(n.created_at),
          read: false,
          icon: <Megaphone size={18} />,
          color: isUrgent ? "bg-error-container/20 text-error" : "bg-primary/10 text-primary",
        });
      });

      // Tasks
      (tasks.data ?? []).forEach((t) => {
        all.push({
          id: `task-${t.id}`,
          title: "📝 Nueva tarea creada",
          description: t.title,
          time: getRelativeTime(t.created_at),
          read: false,
          icon: <ClipboardList size={18} />,
          color: "bg-secondary-container/30 text-secondary",
        });
      });

      // New users
      (users.data ?? []).forEach((u) => {
        const roleLabel =
          u.role === "teacher" ? "Docente" : u.role === "admin" ? "Admin" : "Estudiante";
        all.push({
          id: `user-${u.id}`,
          title: `👤 Nuevo usuario registrado`,
          description: `${u.full_name} (${roleLabel})`,
          time: getRelativeTime(u.created_at),
          read: false,
          icon: <UserCircle size={18} />,
          color: "bg-tertiary-container/20 text-tertiary",
        });
      });

      // Sort by time (Ahora first, then minutes, hours, days)
      all.sort((a, b) => {
        const order = ["Ahora", "min", "hora", "día"];
        const aIdx = order.findIndex((o) => a.time.includes(o));
        const bIdx = order.findIndex((o) => b.time.includes(o));
        if (aIdx !== bIdx) return aIdx - bIdx;
        return b.time.localeCompare(a.time);
      });

      setNotifications(all);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-primary animate-spin" />
          <p className="text-body-lg font-bold text-on-surface-variant">Cargando notificaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Notificaciones</h2>
          <p className="text-body-md font-medium text-on-surface-variant">
            {notifications.length} notificación{notifications.length !== 1 ? "es" : ""} reciente{notifications.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-surface border border-outline text-on-surface-variant rounded-lg font-bold text-label-md hover:bg-surface-container transition-colors flex items-center gap-2"
          >
            <CheckCheck size={16} />
            Marcar todas como leídas
          </button>
          <button
            onClick={loadNotifications}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-label-md hover:bg-primary-container transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-surface rounded-xl border border-outline-variant/30 p-xl">
          <Bell size={64} className="text-on-surface-variant mb-4 opacity-50" />
          <h3 className="text-title-lg font-bold text-on-surface mb-1">No hay notificaciones</h3>
          <p className="text-body-md text-on-surface-variant">Todas las notificaciones aparecerán aquí.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/30 divide-y divide-outline-variant">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-md flex items-start gap-md hover:bg-surface-container-low/30 transition-colors ${
                !notif.read ? "bg-primary/5" : ""
              }`}
            >
              <div className={`${notif.color} p-2 rounded-full flex-shrink-0 mt-1`}>
                {notif.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-label-md font-bold text-on-surface truncate ${!notif.read ? "text-on-surface" : ""}`}>
                    {notif.title}
                  </h4>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
                <p className="text-body-md font-medium text-on-surface-variant mt-0.5">
                  {notif.description}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={12} className="text-outline" />
                  <span className="text-label-sm font-bold text-outline">{notif.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminNotificationsPage() {
  return (
    <AdminLayout>
      <NotificationsContent />
    </AdminLayout>
  );
}