import { createClient } from "@/lib/supabase/client";

export interface AdminDashboardData {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalCourses: number;
  activeTasks: number;
  totalNotices: number;
  weeklyActivity: { day: string; submissions: number; created: number }[];
  recentActivity: {
    id: string;
    action: string;
    details: string;
    time: string;
    type: "user" | "course" | "notice" | "submission" | "task";
  }[];
  todayDate: string;
  adminName: string;
}

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = createClient();

  // 1. Current user (admin name)
  const { data: { user } } = await supabase.auth.getUser();
  let adminName = "Admin";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile) adminName = profile.full_name;
  }

  // 2. KPI counts (run in parallel)
  const [
    { count: totalUsers },
    { count: totalTeachers },
    { count: totalStudents },
    { count: totalCourses },
    { count: activeTasks },
    { count: totalNotices },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("notices").select("*", { count: "exact", head: true }),
  ]);

  // 3. Weekly activity (submissions per day over last 7 days / new users per day)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  const [submissions, newProfiles, notices, tasks] = await Promise.all([
    supabase
      .from("submissions")
      .select("created_at")
      .gte("created_at", sevenDaysAgoISO)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", sevenDaysAgoISO)
      .order("created_at", { ascending: true }),
    supabase
      .from("notices")
      .select("id, title, created_at, author_id")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, created_at, course_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Build weekly activity by day
  const weeklyMap: Record<string, { submissions: number; created: number }> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = DAYS_SHORT[d.getDay()];
    weeklyMap[key] = { submissions: 0, created: 0 };
  }

  (submissions.data ?? []).forEach((s) => {
    const d = new Date(s.created_at);
    const key = DAYS_SHORT[d.getDay()];
    if (weeklyMap[key]) weeklyMap[key].submissions++;
  });

  (newProfiles.data ?? []).forEach((p) => {
    const d = new Date(p.created_at);
    const key = DAYS_SHORT[d.getDay()];
    if (weeklyMap[key]) weeklyMap[key].created++;
  });

  const weeklyActivity = Object.entries(weeklyMap).map(([day, vals]) => ({
    day,
    submissions: vals.submissions,
    created: vals.created,
  }));

  // 4. Recent activity
  const recentActivity: AdminDashboardData["recentActivity"] = [];

  // Recent notices
  (notices.data ?? []).forEach((n) => {
    recentActivity.push({
      id: `notice-${n.id}`,
      action: "Aviso publicado",
      details: n.title,
      time: getRelativeTime(n.created_at),
      type: "notice",
    });
  });

  // Recent tasks
  (tasks.data ?? []).forEach((t) => {
    recentActivity.push({
      id: `task-${t.id}`,
      action: "Nueva tarea creada",
      details: t.title,
      time: getRelativeTime(t.created_at),
      type: "task",
    });
  });

  // Recent new users
  if (newProfiles.data && newProfiles.data.length > 0 && Array.isArray(newProfiles.data)) {
    const recentUsers = newProfiles.data as { created_at: string }[];
    const lastUsers = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    (lastUsers.data ?? []).forEach((p) => {
      const roleLabel =
        p.role === "teacher" ? "Docente" : p.role === "admin" ? "Admin" : "Estudiante";
      recentActivity.push({
        id: `user-${p.id}`,
        action: `Usuario creado`,
        details: `${roleLabel}: ${p.full_name}`,
        time: getRelativeTime(p.created_at),
        type: "user",
      });
    });
  }

  // Sort by time (most recent first) and limit to 5
  recentActivity.sort((a, b) => {
    const order = ["Ahora", "min", "hora", "día"];
    const aIdx = order.findIndex((o) => a.time.includes(o));
    const bIdx = order.findIndex((o) => b.time.includes(o));
    if (aIdx !== bIdx) return aIdx - bIdx;
    return b.time.localeCompare(a.time);
  });

  // 5. Today's date
  const today = new Date();
  const dayNames = [
    "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
  ];
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const todayDate = `${dayNames[today.getDay()]}, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

  return {
    totalUsers: totalUsers ?? 0,
    totalTeachers: totalTeachers ?? 0,
    totalStudents: totalStudents ?? 0,
    totalCourses: totalCourses ?? 0,
    activeTasks: activeTasks ?? 0,
    totalNotices: totalNotices ?? 0,
    weeklyActivity,
    recentActivity: recentActivity.slice(0, 5),
    todayDate,
    adminName,
  };
}