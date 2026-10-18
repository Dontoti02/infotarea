"use client";

import React, { useState, useEffect } from "react";
import { 
  School, 
  Bell, 
  Menu,
  Search,
  LogOut,
  X,
  FileText,
  Megaphone,
  Settings,
  Mail,
  User,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import { studentAlertTitle, type AlertType } from "@/shared/utils/prioritization";
import { WebPresence } from "@/shared/components/communication/WebPresence";
import { PROFILE_BUCKET, buildAvatarPath, storagePathFromPublicUrl } from "@/shared/utils/storage";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

/** Curso mostrado en el buscador global. */
interface SearchCourse {
  id?: string;
  name: string;
  section?: string | null;
}

/** Tarea del buscador global (el curso llega embebido por PostgREST). */
interface SearchTask {
  id: string;
  title: string;
  due_date?: string | null;
  courses?: SearchCourse | SearchCourse[] | null;
}

/** Aviso del buscador global. */
interface SearchNotice {
  id: string;
  title: string;
  category?: string | null;
}

/** Elemento de la campanita (avisos, tareas y alertas inteligentes). */
interface DashboardNotification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  category: string | null;
  date: string;
  author: string;
  href: string;
  unread: boolean;
}

/**
 * PostgREST puede embeber una relación como objeto (a-uno) o como lista
 * (a-muchos) y el tipado del cliente siempre asume lista. Este helper unifica
 * ambos casos al leer un embed.
 */
function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  mainNavItems: NavItem[];
  userName?: string;
  userRole?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  teacher: "Docente",
  student: "Estudiante",
  parent: "Padre de Familia",
};

/** Mensaje de éxito/error dentro del modal «Mi Cuenta». */
function ModalBanner({ msg }: { msg: { type: "success" | "error"; text: string } | null }) {
  if (!msg) return null;
  const ok = msg.type === "success";
  return (
    <div className={`p-3 rounded-lg flex items-start gap-2 text-label-sm font-medium ${ok ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]" : "bg-error-container text-on-error-container border border-error/20"}`}>
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}

export function DashboardLayout({ 
  children, 
  mainNavItems, 
  userName = "Usuario",
  userRole = "Estudiante"
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  // Custom interactive header states
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") {
        // Lectura intencional del localStorage al montar el layout.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", next ? "true" : "false");
      return next;
    });
  };

  // Profile detailed states
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userRoleKey, setUserRoleKey] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userBio, setUserBio] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // «Mi Cuenta»: edición de foto, datos y contraseña
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showModalPwd, setShowModalPwd] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    pages: { label: string; href: string; icon: React.ElementType }[];
    courses: SearchCourse[];
    tasks: SearchTask[];
    notices: SearchNotice[];
  }>({ pages: [], courses: [], tasks: [], notices: [] });

  // Notifications states
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url, bio")
        .eq("id", user.id)
        .single();

      if (profile) {
        setProfileId(profile.id);
        setProfileName(profile.full_name || null);
        setProfileRole(ROLE_LABELS[profile.role] ?? profile.role);
        setUserRoleKey(profile.role);
        setAvatarUrl(profile.avatar_url || null);
        setUserBio(profile.bio || null);
      }
      setUserEmail(user.email || null);
    }
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = profileName ?? userName;
  const displayRole = profileRole ?? userRole;

  // ── «Mi Cuenta»: foto, datos y contraseña ────────────────────────────────
  const MODAL_MAX_AVATAR_BYTES = 5 * 1024 * 1024;

  const handleModalAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profileId) return;
    if (!file.type.startsWith("image/")) {
      setModalMsg({ type: "error", text: "Selecciona una imagen válida (JPG, PNG, etc.)." });
      return;
    }
    if (file.size > MODAL_MAX_AVATAR_BYTES) {
      setModalMsg({ type: "error", text: "La imagen no debe superar los 5 MB." });
      return;
    }
    setUploadingAvatar(true);
    setModalMsg(null);
    try {
      const filePath = buildAvatarPath(profileId, file.name);
      if (!filePath) {
        setModalMsg({ type: "error", text: "No se pudo preparar la imagen." });
        return;
      }
      const { error: uploadError } = await supabase.storage.from(PROFILE_BUCKET).upload(filePath, file);
      if (uploadError) {
        setModalMsg({ type: "error", text: "Error al subir imagen: " + uploadError.message });
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(filePath);
      const previousPath = storagePathFromPublicUrl(avatarUrl, PROFILE_BUCKET);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profileId);
      if (updateError) {
        setModalMsg({ type: "error", text: "Error al actualizar foto: " + updateError.message });
        return;
      }
      // Limpieza opcional: borra la foto anterior si vivía en el mismo bucket.
      if (previousPath) await supabase.storage.from(PROFILE_BUCKET).remove([previousPath]);
      setAvatarUrl(publicUrl);
      setModalMsg({ type: "success", text: "Foto de perfil actualizada." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleModalSaveProfile = async () => {
    if (!profileId) return;
    const name = editName.trim();
    if (name.length < 3) {
      setModalMsg({ type: "error", text: "El nombre debe tener al menos 3 caracteres." });
      return;
    }
    setSavingProfile(true);
    setModalMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, bio: editBio.trim(), updated_at: new Date().toISOString() })
        .eq("id", profileId);
      if (error) {
        setModalMsg({ type: "error", text: "Error al guardar: " + error.message });
        return;
      }
      setProfileName(name);
      setUserBio(editBio.trim() || null);
      setModalMsg({ type: "success", text: "Datos actualizados correctamente." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleModalChangePassword = async () => {
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMsg({ type: "error", text: "Error al cambiar contraseña: " + error.message });
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "success", text: "¡Contraseña actualizada! Úsala en tu próximo inicio de sesión." });
    } finally {
      setSavingPassword(false);
    }
  };

  // Load notifications (Notices and upcoming Tasks)
  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch latest notices (avisos)
      const { data: noticesData } = await supabase
        .from("notices")
        .select("id, title, content, category, created_at, expire_at, profiles(full_name)")
        .order("created_at", { ascending: false });

      const activeNotices = (noticesData || []).filter(n => {
        if (n.expire_at) {
          return new Date(n.expire_at).getTime() >= Date.now();
        }
        return true;
      }).slice(0, 5);

      // 2. Fetch student-specific tasks
      let tasksData: SearchTask[] = [];
      const currentRole = userRoleKey || (pathname.split("/")[1]) || "student";
      
      if (currentRole === "student") {
        const { data: memberships } = await supabase
          .from("course_members")
          .select("course_id")
          .eq("profile_id", user.id);
        const courseIds = memberships?.map(m => m.course_id) || [];
        
        if (courseIds.length > 0) {
          const { data } = await supabase
            .from("tasks")
            .select("id, title, due_date, courses(name)")
            .in("course_id", courseIds)
            .order("created_at", { ascending: false })
            .limit(5);
          
          tasksData = data || [];
        }
      }

      // 3. Fetch the student's own smart alerts (low performance, etc.).
      type SmartAlertRow = {
        id: string;
        alert_type: AlertType;
        severity: string;
        title: string;
        message: string;
        created_at: string;
      };
      let alertsData: SmartAlertRow[] = [];
      if (currentRole === "student") {
        const { data } = await supabase
          .from("smart_alerts")
          .select("id, alert_type, severity, title, message, created_at")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);
        alertsData = (data as SmartAlertRow[] | null) ?? [];
      }

      const noticesMapped = activeNotices.map(n => ({
        id: n.id,
        type: "notice",
        title: n.title,
        description: n.content,
        category: n.category,
        date: n.created_at,
        author: firstEmbedded(n.profiles)?.full_name || "Administración",
        href: `/${currentRole}/avisos`
      }));

      const tasksMapped = tasksData.map(t => ({
        id: t.id,
        type: "task",
        title: `Nueva Tarea: ${t.title}`,
        description: `Asignatura: ${(Array.isArray(t.courses) ? t.courses[0]?.name : t.courses?.name) || ""}. Vence: ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Sin fecha límite'}`,
        category: "academic",
        date: t.due_date || new Date().toISOString(),
        author: "Docente",
        href: `/student/tareas?task_id=${t.id}`
      }));

      const alertsMapped = alertsData.map(a => ({
        id: `alert-${a.id}`,
        type: "alert",
        title: studentAlertTitle(a.alert_type, a.title),
        description: a.message,
        category: a.severity,
        date: a.created_at,
        author: "Componente inteligente",
        href: "/student/seguimiento"
      }));

      const combined = [...noticesMapped, ...tasksMapped, ...alertsMapped].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const readIds = JSON.parse(localStorage.getItem("read_notifications") || "[]");
      const list = combined.map(item => ({
        ...item,
        unread: !readIds.includes(item.id)
      }));

      setNotifications(list);
      setUnreadCount(list.filter(n => n.unread).length);
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  };

  useEffect(() => {
    if (userRoleKey) {
      // Cargar notificaciones al cambiar de sección/rol es intencional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadNotifications();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRoleKey, pathname]);

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    const readIds = notifications.map(n => n.id);
    localStorage.setItem("read_notifications", JSON.stringify(readIds));
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    setUnreadCount(0);
  };

  // Click on a notification
  const handleNotificationClick = (notification: DashboardNotification) => {
    const readIds = JSON.parse(localStorage.getItem("read_notifications") || "[]");
    if (!readIds.includes(notification.id)) {
      readIds.push(notification.id);
      localStorage.setItem("read_notifications", JSON.stringify(readIds));
    }
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, unread: false } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    setIsNotificationsOpen(false);
    router.push(notification.href);
  };

  // Keyboard shortcut Ctrl+K or / to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search filter handler (Debounced)
  useEffect(() => {
    if (!isSearchOpen) return;

    const currentRole = userRoleKey || (pathname.split("/")[1]) || "student";
    const availablePages = mainNavItems.map(item => ({
      label: item.label,
      href: item.href,
      icon: item.icon
    }));

    if (!searchTerm.trim()) {
      // Limpiar los resultados al abrir/cerrar el buscador es intencional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults({
        pages: availablePages,
        courses: [],
        tasks: [],
        notices: []
      });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const query = searchTerm.trim().toLowerCase();
        
        // Match Sidebar Pages
        const matchedPages = availablePages.filter(p => 
          p.label.toLowerCase().includes(query)
        );

        // Fetch courses matching query
        let matchedCourses: SearchCourse[] = [];
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (currentRole === "admin") {
            const { data } = await supabase
              .from("courses")
              .select("id, name, section")
              .ilike("name", `%${query}%`)
              .limit(5);
            matchedCourses = data || [];
          } else if (currentRole === "teacher") {
            const { data } = await supabase
              .from("courses")
              .select("id, name, section")
              .eq("teacher_id", user.id)
              .ilike("name", `%${query}%`)
              .limit(5);
            matchedCourses = data || [];
          } else {
            const { data: memberships } = await supabase
              .from("course_members")
              .select("course_id, courses(id, name, section)")
              .eq("profile_id", user.id);
            
            const list: SearchCourse[] = (memberships || []).flatMap(m => {
              const course = firstEmbedded<SearchCourse>(m.courses);
              return course && course.name.toLowerCase().includes(query) ? [course] : [];
            });
            matchedCourses = list.slice(0, 5);
          }
        }

        // Fetch tasks matching query
        let matchedTasks: SearchTask[] = [];
        if (user) {
          if (currentRole === "admin") {
            const { data } = await supabase
              .from("tasks")
              .select("id, title, course_id, courses(name)")
              .ilike("title", `%${query}%`)
              .limit(5);
            matchedTasks = data || [];
          } else if (currentRole === "teacher") {
            const { data: teacherCourses } = await supabase
              .from("courses")
              .select("id")
              .eq("teacher_id", user.id);
            const courseIds = teacherCourses?.map(c => c.id) || [];
            if (courseIds.length > 0) {
              const { data } = await supabase
                .from("tasks")
                .select("id, title, course_id, courses(name)")
                .in("course_id", courseIds)
                .ilike("title", `%${query}%`)
                .limit(5);
              matchedTasks = data || [];
            }
          } else {
            const { data: memberships } = await supabase
              .from("course_members")
              .select("course_id")
              .eq("profile_id", user.id);
            const courseIds = memberships?.map(m => m.course_id) || [];
            if (courseIds.length > 0) {
              const { data } = await supabase
                .from("tasks")
                .select("id, title, course_id, courses(name)")
                .in("course_id", courseIds)
                .ilike("title", `%${query}%`)
                .limit(5);
              matchedTasks = data || [];
            }
          }
        }

        // Fetch notices matching query
        const { data: noticesData } = await supabase
          .from("notices")
          .select("id, title, category, expire_at")
          .ilike("title", `%${query}%`);
        
        const matchedNotices = (noticesData || [])
          .filter(n => {
            if (n.expire_at) {
              return new Date(n.expire_at).getTime() >= Date.now();
            }
            return true;
          })
          .slice(0, 5);

        setSearchResults({
          pages: matchedPages,
          courses: matchedCourses,
          tasks: matchedTasks,
          notices: matchedNotices
        });
      } catch (err) {
        console.error("Error global searching:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, isSearchOpen, userRoleKey, pathname]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      router.push("/login");
      router.refresh();
    }
  };


  return (
    <div className="min-h-screen flex bg-background text-on-background font-sans antialiased">
      <WebPresence userId={profileId} />
      {/* Sidebar Backdrop for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`bg-surface-container-lowest fixed left-0 top-0 h-full border-r border-outline-variant shadow-sm flex flex-col pb-md z-50 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 flex ${isSidebarCollapsed ? 'md:w-[72px]' : 'md:w-[280px]'}`}
      >
        {/* Navigation Links */}
        <nav className="flex-1 px-sm overflow-y-auto w-full pt-6">
          {/* Brand Header */}
          <div className={`px-xl mb-6 transition-all duration-300 text-center ${isSidebarCollapsed ? 'px-xs' : 'px-xl'}`}>
            <div className="flex flex-col items-center justify-center gap-xs">
              <img 
                src="/assets/logo.png" 
                alt="Logo" 
                className={`object-contain transition-all duration-300 ${
                  isSidebarCollapsed ? 'w-12 h-12' : 'w-36 h-24'
                }`} 
              />
              {!isSidebarCollapsed && (
                <div className="animate-fade-in whitespace-nowrap mt-1">
                  <span className="inline-block px-3 py-1 text-[11px] font-black uppercase tracking-widest bg-primary/10 text-primary rounded-full border border-primary/20 shadow-sm">
                    {displayRole}
                  </span>
                </div>
              )}
            </div>
          </div>

          <ul className="flex flex-col gap-xs">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.label}>
                  <Link 
                    href={item.href}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`flex items-center gap-md py-sm transition-all duration-200 active:scale-95 group ${
                      isSidebarCollapsed 
                        ? "justify-center rounded-xl px-0" 
                        : "px-md rounded-r-full"
                    } ${
                      isActive 
                        ? "bg-secondary-container text-on-secondary-container border-l-4 border-primary font-bold" 
                        : "text-on-surface-variant hover:bg-surface-container-low font-semibold"
                    }`}
                  >
                    <item.icon 
                      size={20} 
                      className={`shrink-0 transition-all duration-300 ease-out ${
                        isActive 
                          ? "text-primary scale-110" 
                          : "text-on-surface-variant group-hover:scale-115 group-hover:rotate-[8deg] group-hover:text-primary"
                      }`} 
                    />
                    {!isSidebarCollapsed && (
                      <span className="text-label-md animate-fade-in whitespace-nowrap">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar bottom spacing */}
        <div className="mt-auto pt-md w-full" />
      </aside>

      {/* Main Content Wrapper */}
      <div 
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[280px]'
        }`}
      >
        {/* Top App Bar */}
        <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-40 border-b border-outline-variant flex justify-between items-center h-16 px-md md:px-xl">
          <div className="flex items-center gap-md flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-on-surface-variant hover:bg-surface-container rounded-full cursor-pointer"
            >
              <Menu size={24} />
            </button>
            
            {/* Sidebar trigger for desktop collapse */}
            <button 
              onClick={toggleSidebarCollapse}
              className="hidden md:flex p-2 text-on-surface-variant hover:bg-surface-container rounded-full cursor-pointer transition-all duration-200 hover:text-primary active:scale-95"
              style={{ transform: isSidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
              title={isSidebarCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            >
              <ChevronLeft size={20} />
            </button>
            
            {/* Global Search Trigger (Desktop) */}
            <div className="w-full max-w-md hidden sm:block">
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center gap-sm bg-surface-container-low border border-outline-variant rounded-full px-4 py-2 text-on-surface-variant hover:bg-surface-container transition-all text-left cursor-pointer group hover:border-primary/50"
              >
                <Search size={16} className="text-outline transition-all duration-300 group-hover:scale-115 group-hover:rotate-[8deg] group-hover:text-primary shrink-0" />
                <span className="text-body-md text-on-surface-variant flex-1 truncate">Buscar páginas, cursos, tareas...</span>
                <kbd className="text-[10px] bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant font-mono text-on-surface-variant shrink-0">Ctrl+K</kbd>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-md">
            {/* Global Search Trigger (Mobile) */}
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-all group"
              title="Buscar"
            >
              <Search size={20} className="transition-all duration-300 group-hover:scale-115 group-hover:rotate-[8deg] group-hover:text-primary" />
            </button>

            {/* Notifications Bell Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setIsNotificationsOpen(prev => !prev);
                  setIsProfileOpen(false);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-all relative group"
                title="Notificaciones"
              >
                <Bell size={20} className="transition-all duration-300 group-hover:scale-115 group-hover:rotate-[15deg] group-hover:text-primary" />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Notifications Popover Dropdown */}
              {isNotificationsOpen && (
                <>
                  {/* Click backdrop to close */}
                  <div className="fixed inset-0 z-[90] bg-transparent" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute right-0 top-12 w-80 sm:w-96 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xl z-[95] overflow-hidden flex flex-col max-h-[480px] animate-scale-up">
                    {/* Header */}
                    <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                      <span className="text-title-sm font-bold text-on-surface flex items-center gap-1">
                        <Bell size={16} /> Notificaciones
                        {unreadCount > 0 && (
                          <span className="bg-error text-white font-black text-[10px] px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-sm">
                            {unreadCount}
                          </span>
                        )}
                      </span>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-label-sm font-bold text-primary hover:underline hover:text-primary-container transition-colors"
                        >
                          Marcar leídas
                        </button>
                      )}
                    </div>

                    {/* Feed List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/30 scrollbar-thin">
                      {notifications.length === 0 ? (
                        <div className="text-center py-12 text-on-surface-variant">
                          <Bell size={32} className="mx-auto text-outline-variant mb-2 opacity-50" />
                          <p className="text-body-md font-bold">Sin novedades</p>
                          <p className="text-label-sm mt-0.5">Estás completamente al día con tus avisos.</p>
                        </div>
                      ) : (
                        notifications.map(item => (
                          <div 
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={`p-md flex gap-md cursor-pointer hover:bg-surface-container transition-colors text-left ${item.unread ? 'bg-primary/5' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              item.type === 'alert'
                                ? 'bg-error/10 text-error'
                                : item.type === 'task'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.type === 'alert'
                                ? <AlertTriangle size={16} />
                                : item.type === 'task'
                                  ? <FileText size={16} />
                                  : <Megaphone size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-0.5">
                                <p className={`text-body-sm text-on-surface truncate pr-2 ${item.unread ? 'font-bold' : 'font-medium'}`}>
                                  {item.title}
                                </p>
                                {item.unread && (
                                  <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0 mt-1.5" />
                                )}
                              </div>
                              <p className="text-label-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                              <span className="text-[10px] font-medium text-on-surface-variant/70 mt-1 block">
                                {item.author} • {new Date(item.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer view all */}
                    <Link 
                      href={`/${userRoleKey || 'student'}/avisos`}
                      onClick={() => setIsNotificationsOpen(false)}
                      className="block text-center py-3 bg-surface-container-low border-t border-outline-variant text-label-md font-bold text-primary hover:bg-surface-container transition-colors"
                    >
                      Ver todos los avisos
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Profile Menu Dropdown */}
            <div className="relative flex items-center">
              <button 
                onClick={() => {
                  setIsProfileOpen(prev => !prev);
                  setIsNotificationsOpen(false);
                }}
                className="flex items-center gap-sm pl-md border-l border-outline-variant hover:opacity-80 transition-all cursor-pointer text-left focus:outline-none group"
                title="Menú de perfil"
              >
                <div className="text-right hidden md:block mr-1">
                  <p className="text-label-md font-bold text-on-surface leading-tight">{displayName}</p>
                  <p className="text-label-sm text-on-surface-variant">{displayRole}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-outline-variant overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:rotate-[6deg] shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-primary text-label-md">{getInitials(displayName)}</span>
                  )}
                </div>
              </button>

              {/* User Profile Popover Dropdown */}
              {isProfileOpen && (
                <>
                  {/* Click backdrop to close */}
                  <div className="fixed inset-0 z-[90] bg-transparent" onClick={() => setIsProfileOpen(false)} />
                  <div className="absolute right-0 top-12 w-72 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xl z-[95] overflow-hidden flex flex-col p-md gap-md animate-scale-up text-left">
                    {/* Account Header */}
                    <div className="flex items-center gap-md">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-outline-variant overflow-hidden shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-primary text-title-md">{getInitials(displayName)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-body-md font-bold text-on-surface truncate leading-tight">{displayName}</p>
                        <p className="text-label-sm text-on-surface-variant truncate mb-1">{userEmail || "Sin correo"}</p>
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                          {displayRole}
                        </span>
                      </div>
                    </div>

                    {userBio && (
                      <div className="bg-surface px-sm py-1.5 rounded-lg border border-outline-variant/40">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Biografía</p>
                        <p className="text-label-sm text-on-surface-variant italic line-clamp-2">&ldquo;{userBio}&rdquo;</p>
                      </div>
                    )}

                    <div className="h-px bg-outline-variant/40" />

                    {/* Menu Options */}
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => {
                          setIsProfileOpen(false);
                          setEditName(profileName ?? "");
                          setEditBio(userBio ?? "");
                          setModalMsg(null);
                          setNewPassword("");
                          setConfirmPassword("");
                          setPasswordMsg(null);
                          setIsProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-md text-on-surface-variant hover:bg-surface-container-low px-md py-sm transition-all duration-200 rounded-lg text-left font-bold text-label-md cursor-pointer group"
                      >
                        <User size={18} className="text-on-surface-variant shrink-0 transition-all duration-300 group-hover:scale-115 group-hover:rotate-[8deg] group-hover:text-primary" />
                        <span>Mi Cuenta</span>
                      </button>
                      <Link 
                        href={`/${userRoleKey || 'student'}/notificaciones`}
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full flex items-center gap-md text-on-surface-variant hover:bg-surface-container-low px-md py-sm transition-all duration-200 rounded-lg text-left font-bold text-label-md group"
                      >
                        <Bell size={18} className="text-on-surface-variant shrink-0 transition-all duration-300 group-hover:scale-115 group-hover:rotate-[12deg] group-hover:text-primary" />
                        <span>Notificaciones</span>
                      </Link>
                      <Link 
                        href={`/${userRoleKey || 'student'}/configuracion`}
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full flex items-center gap-md text-on-surface-variant hover:bg-surface-container-low px-md py-sm transition-all duration-200 rounded-lg text-left font-bold text-label-md group"
                      >
                        <Settings size={18} className="text-on-surface-variant shrink-0 transition-all duration-300 group-hover:scale-115 group-hover:rotate-[30deg] group-hover:text-primary" />
                        <span>Configuración</span>
                      </Link>
                    </div>

                    <div className="h-px bg-outline-variant/40" />

                    {/* Logout Button */}
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-md text-error hover:bg-error/10 px-md py-sm transition-all duration-200 rounded-lg text-left font-bold text-label-md cursor-pointer group"
                    >
                      <LogOut size={18} className="transition-all duration-300 group-hover:scale-115 group-hover:translate-x-1" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <main className="flex-1 p-md md:p-xl">
          <div className="max-w-[1440px] mx-auto space-y-xl">
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette / Search Modal */}
      {isSearchOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-10 sm:pt-20 bg-black/40 backdrop-blur-sm animate-fade-in">
          {/* Transparent click backdrop specifically for close */}
          <div className="absolute inset-0 -z-10" onClick={() => setIsSearchOpen(false)} />
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px] animate-scale-up">
            {/* Search Input Area */}
            <div className="flex items-center gap-md px-lg py-md border-b border-outline-variant">
              <Search className="text-primary" size={22} />
              <input 
                type="text" 
                autoFocus
                placeholder="Buscar páginas, cursos, tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-0 text-title-md text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-0 outline-none"
              />
              {searching ? (
                <Loader2 className="animate-spin text-primary shrink-0" size={18} />
              ) : (
                <kbd className="hidden sm:inline-block text-[10px] bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant font-mono text-on-surface-variant">ESC</kbd>
              )}
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-md space-y-md scrollbar-thin">
              {/* If search query is empty */}
              {!searchTerm.trim() && (
                <div className="space-y-sm">
                  <span className="text-label-sm font-bold text-primary uppercase tracking-wider px-sm block">Atajos de Navegación</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
                    {searchResults.pages.map(p => (
                      <button
                        key={p.href}
                        onClick={() => {
                          setIsSearchOpen(false);
                          router.push(p.href);
                        }}
                        className="flex items-center gap-sm px-sm py-2 rounded-xl text-left hover:bg-primary-container/15 text-on-surface hover:text-primary transition-all group font-medium"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <p.icon size={16} />
                        </div>
                        <span className="text-body-md font-bold">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matches found */}
              {searchTerm.trim() && (
                <>
                  {searchResults.pages.length === 0 && 
                   searchResults.courses.length === 0 && 
                   searchResults.tasks.length === 0 && 
                   searchResults.notices.length === 0 ? (
                    <div className="text-center py-10 text-on-surface-variant">
                      <p className="text-body-lg font-bold">No se encontraron resultados</p>
                      <p className="text-body-md mt-1">Intenta con otra palabra clave como &ldquo;matemáticas&rdquo; o &ldquo;tarea&rdquo;.</p>
                    </div>
                  ) : (
                    <div className="space-y-md text-left">
                      {/* Pages Category */}
                      {searchResults.pages.length > 0 && (
                        <div className="space-y-xs">
                          <span className="text-label-sm font-bold text-primary uppercase tracking-wider px-sm block">Páginas</span>
                          {searchResults.pages.map(p => (
                            <button
                              key={p.href}
                              onClick={() => {
                                setIsSearchOpen(false);
                                router.push(p.href);
                              }}
                              className="w-full flex items-center gap-sm px-sm py-sm rounded-xl text-left hover:bg-surface-container transition-colors group"
                            >
                              <div className="w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                                <p.icon size={14} />
                              </div>
                              <span className="text-body-md font-bold text-on-surface">{p.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Courses Category */}
                      {searchResults.courses.length > 0 && (
                        <div className="space-y-xs border-t border-outline-variant/30 pt-sm">
                          <span className="text-label-sm font-bold text-secondary uppercase tracking-wider px-sm block">Mis Cursos</span>
                          {searchResults.courses.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setIsSearchOpen(false);
                                router.push(`/${userRoleKey || 'student'}/cursos/${c.id}`);
                              }}
                              className="w-full flex items-center gap-sm px-sm py-sm rounded-xl text-left hover:bg-surface-container transition-colors group"
                            >
                              <div className="w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-secondary group-hover:text-secondary transition-colors">
                                <School size={14} />
                              </div>
                              <div>
                                <span className="text-body-md font-bold text-on-surface block leading-tight">{c.name}</span>
                                <span className="text-label-sm text-on-surface-variant">Sección: {c.section}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Tasks Category */}
                      {searchResults.tasks.length > 0 && (
                        <div className="space-y-xs border-t border-outline-variant/30 pt-sm">
                          <span className="text-label-sm font-bold text-primary uppercase tracking-wider px-sm block">Tareas y Actividades</span>
                          {searchResults.tasks.map(t => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setIsSearchOpen(false);
                                if (userRoleKey === "student") {
                                  router.push(`/student/tareas?task_id=${t.id}`);
                                } else if (userRoleKey === "teacher") {
                                  router.push(`/teacher/entregas?task_id=${t.id}`);
                                } else {
                                  router.push(`/admin/tareas`);
                                }
                              }}
                              className="w-full flex items-center gap-sm px-sm py-sm rounded-xl text-left hover:bg-surface-container transition-colors group"
                            >
                              <div className="w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-primary group-hover:text-primary/80 transition-colors">
                                <FileText size={14} />
                              </div>
                              <div>
                                <span className="text-body-md font-bold text-on-surface block leading-tight">{t.title}</span>
                                <span className="text-label-sm text-on-surface-variant">Curso: {(Array.isArray(t.courses) ? t.courses[0]?.name : t.courses?.name) || 'Asignatura'}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Notices Category */}
                      {searchResults.notices.length > 0 && (
                        <div className="space-y-xs border-t border-outline-variant/30 pt-sm">
                          <span className="text-label-sm font-bold text-amber-600 uppercase tracking-wider px-sm block">Avisos y Novedades</span>
                          {searchResults.notices.map(n => (
                            <button
                              key={n.id}
                              onClick={() => {
                                setIsSearchOpen(false);
                                router.push(`/${userRoleKey || 'student'}/avisos`);
                              }}
                              className="w-full flex items-center gap-sm px-sm py-sm rounded-xl text-left hover:bg-surface-container transition-colors group"
                            >
                              <div className="w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-amber-600 group-hover:text-amber-500 transition-colors">
                                <Megaphone size={14} />
                              </div>
                              <div>
                                <span className="text-body-md font-bold text-on-surface block leading-tight">{n.title}</span>
                                <span className="text-label-sm text-on-surface-variant font-medium uppercase tracking-wider">{n.category}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Quick Tips Footer */}
            <div className="bg-surface-container px-lg py-sm text-label-sm text-on-surface-variant flex items-center gap-1 border-t border-outline-variant">
              <Sparkles size={12} className="text-primary shrink-0" />
              <span>Tip: Escribe palabras clave para buscar rápidamente entre tus cursos o tareas asignadas.</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Profile Detail Modal */}
      {isProfileModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[28rem] relative overflow-hidden flex flex-col max-h-[92vh]">
            <div className="h-1.5 w-full bg-primary shrink-0" />
            <button 
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant bg-surface-container-lowest/70 backdrop-blur hover:bg-surface-container transition-colors"
            >
              <X size={18} />
            </button>
            <div className="p-6 space-y-md overflow-y-auto">
              {/* Cabecera: foto editable + identidad */}
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center border-2 border-primary/20 overflow-hidden shadow-sm">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-headline-md font-black">{getInitials(displayName)}</span>
                    )}
                  </div>
                  <label
                    title="Cambiar foto de perfil"
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary-container transition-colors"
                  >
                    {uploadingAvatar ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleModalAvatarChange} disabled={uploadingAvatar} />
                  </label>
                </div>
                <h3 className="text-title-lg font-black text-on-surface leading-tight mt-3">{displayName}</h3>
                <span className="inline-flex px-3 py-1 mt-1 rounded-full text-label-sm font-bold bg-primary-container text-on-primary-container">
                  {displayRole}
                </span>
              </div>

              {/* Datos personales (editables) */}
              <div className="bg-surface p-md rounded-xl border border-outline-variant/50 space-y-sm text-left">
                <div className="flex items-center gap-sm text-on-surface-variant">
                  <Mail size={16} className="text-primary shrink-0" />
                  <span className="text-body-md truncate">{userEmail || "Sin correo"}</span>
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-on-surface mb-1" htmlFor="mi-cuenta-nombre">Nombre completo</label>
                  <input
                    id="mi-cuenta-nombre"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-on-surface mb-1" htmlFor="mi-cuenta-bio">Biografía</label>
                  <textarea
                    id="mi-cuenta-bio"
                    rows={2}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Escribe algo sobre ti..."
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                  />
                </div>
                <ModalBanner msg={modalMsg} />
                <button
                  onClick={handleModalSaveProfile}
                  disabled={savingProfile}
                  className="w-full py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-full font-bold text-label-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {savingProfile && <Loader2 size={16} className="animate-spin" />}
                  {savingProfile ? "Guardando..." : "Guardar datos"}
                </button>
              </div>

              {/* Cambiar contraseña */}
              <div className="bg-surface p-md rounded-xl border border-outline-variant/50 space-y-sm text-left">
                <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/35">
                  <KeyRound size={16} className="text-primary shrink-0" />
                  <span className="text-label-md font-bold text-on-surface">Cambiar contraseña</span>
                </div>
                <div className="relative">
                  <input
                    type={showModalPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    autoComplete="new-password"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 pr-10 py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPwd(!showModalPwd)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface transition-colors"
                    aria-label={showModalPwd ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showModalPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input
                  type={showModalPwd ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar contraseña"
                  autoComplete="new-password"
                  className={`w-full bg-surface-container-lowest border rounded-lg px-3 py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all ${confirmPassword && newPassword !== confirmPassword ? "border-error focus:ring-error" : "border-outline-variant"}`}
                />
                <ModalBanner msg={passwordMsg} />
                <button
                  onClick={handleModalChangePassword}
                  disabled={savingPassword}
                  className="w-full py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-full font-bold text-label-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {savingPassword && <Loader2 size={16} className="animate-spin" />}
                  {savingPassword ? "Actualizando..." : "Cambiar contraseña"}
                </button>
              </div>

              <Link
                href={`/${userRoleKey || "student"}/configuracion`}
                onClick={() => setIsProfileModalOpen(false)}
                className="block text-center text-label-sm font-bold text-primary hover:text-primary-container transition-colors pb-1"
              >
                Ir a configuración avanzada
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
