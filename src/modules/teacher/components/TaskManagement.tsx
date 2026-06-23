"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  LayoutList, 
  Calendar as CalendarIcon, 
  Search, 
  CalendarDays, 
  AlertTriangle, 
  CheckCircle2,
  Loader2,
  FolderOpen,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";

export function TaskManagement() {
  const pathname = usePathname();
  const isAdminContext = pathname.startsWith('/admin');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [coursesList, setCoursesList] = useState<any[]>([]);

  const supabase = createClient();

  const stripHtml = (html: string) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check user role to determine course fetching scope
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      let query = supabase.from("courses").select("id, name, section");
      if (profile?.role !== "admin") {
        query = query.eq("teacher_id", user.id);
      }

      const { data: coursesData } = await query;

      if (coursesData) {
        setCoursesList(coursesData);
      }

      const courseIds = coursesData?.map(c => c.id) || [];
      if (courseIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Fetch tasks along with courses and submissions
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          courses (
            id,
            name,
            section
          ),
          submissions (
            id,
            status
          )
        `)
        .in("course_id", courseIds)
        .order("created_at", { ascending: false });

      if (data && !error) {
        // Fetch total student count for each course to calculate submissions ratio (e.g. 12/30)
        const { data: members } = await supabase
          .from("course_members")
          .select("course_id, profiles(role)")
          .in("course_id", courseIds);

        const courseStudentCounts: Record<string, number> = {};
        (members ?? []).forEach((m: any) => {
          if (m.course_id && m.profiles?.role === "student") {
            courseStudentCounts[m.course_id] = (courseStudentCounts[m.course_id] || 0) + 1;
          }
        });

        const mappedTasks = data.map((t: any) => {
          const totalStudents = courseStudentCounts[t.course_id] || 0;
          const submissionsCount = t.submissions?.length || 0;
          
          const isOverdue = t.due_date && new Date(t.due_date) < new Date();
          const pendingSubmissions = t.submissions?.filter((s: any) => s.status === 'pending').length || 0;
          
          let status = "Pendiente";
          let statusStyle = "bg-amber-100 text-amber-800 border-amber-200";
          let accent = "bg-amber-500/50";

          if (isOverdue && submissionsCount < totalStudents) {
            status = "Vencido";
            statusStyle = "bg-rose-100 text-rose-800 border-rose-200";
            accent = "bg-rose-500/50";
          } else if (pendingSubmissions > 0) {
            status = "Para Revisar";
            statusStyle = "bg-primary-container/20 text-primary border-primary/20";
            accent = "bg-primary";
          } else if (submissionsCount === totalStudents && totalStudents > 0) {
            status = "Revisado";
            statusStyle = "bg-teal-50 text-teal-800 border-teal-200";
            accent = "bg-teal-500/50";
          }

          return {
            id: t.id,
            title: t.title,
            course: `${t.courses?.name} - ${t.courses?.section}`,
            courseId: t.course_id,
            status,
            desc: stripHtml(t.description) || "Sin descripción disponible.",
            date: t.due_date ? new Date(t.due_date).toLocaleDateString() : "Sin fecha límite",
            submissions: `${submissionsCount}/${totalStudents}`,
            accent,
            statusStyle,
            isOverdue
          };
        });

        setTasks(mappedTasks);
      }
    } catch (err) {
      console.error("Error loading tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm("¿Estás seguro de que deseas eliminar esta tarea? Esto eliminará permanentemente todas las entregas asociadas de los alumnos.");
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) {
        throw error;
      }

      // Filter out of state
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: any) {
      console.error("Error deleting task:", err);
      alert("Error al eliminar la tarea: " + (err.message || err));
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter(t => {
    if (selectedCourseFilter !== "all" && t.courseId !== selectedCourseFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      return t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
             t.desc.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-xl">
      {/* Toolbar: Tabs & Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-md">
        {/* Tabs */}
        <div className="flex p-1 bg-surface-container-low rounded-xl inline-flex shadow-inner">
          <button className="px-lg py-sm bg-surface-container-lowest text-primary font-bold text-label-md rounded-lg shadow-sm border border-outline-variant/30 flex items-center gap-sm">
            <LayoutList size={16} /> Lista
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-sm w-full xl:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4.5 h-4.5" />
            <input 
              className="w-full pl-10 pr-sm py-sm rounded-lg border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-shadow" 
              placeholder="Buscar tarea..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select 
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-sm py-sm rounded-lg border border-outline-variant bg-surface-container-lowest text-label-md font-bold text-on-surface-variant focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="all">Todos los Cursos</option>
            {coursesList.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 text-center">
          <FolderOpen size={48} className="mx-auto text-outline-variant mb-4" />
          <p className="text-body-lg font-bold text-on-surface-variant">No se encontraron tareas</p>
          <p className="text-body-md text-on-surface-variant mt-1">Crea una nueva tarea para comenzar a recibir entregas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
          {filteredTasks.map((task) => (
            <Link 
              key={task.id} 
              href={isAdminContext ? `/admin/entregas?task_id=${task.id}` : `/teacher/entregas?task_id=${task.id}`}
              className="bg-surface-container-lowest p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30 flex flex-col gap-md cursor-pointer relative overflow-hidden group"
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${task.accent}`}></div>
              <div className="flex justify-between items-start gap-md">
                <div className="flex flex-col gap-xs flex-1">
                  <span className="text-label-sm font-bold text-primary uppercase tracking-wider">{task.course}</span>
                  <h3 className="text-title-lg font-bold text-on-surface group-hover:text-primary transition-colors">{task.title}</h3>
                </div>
                <div className="flex items-center gap-xs shrink-0 z-10">
                  <span className={`px-sm py-1 rounded-md font-bold text-label-md border ${task.statusStyle}`}>
                    {task.status}
                  </span>
                  <button
                    onClick={(e) => handleDeleteTask(e, task.id)}
                    className="p-1.5 rounded-lg text-outline-variant hover:text-error hover:bg-error-container/20 transition-all"
                    title="Eliminar tarea"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <p className="text-body-md text-on-surface-variant line-clamp-2">{task.desc}</p>
              <div className="mt-auto pt-md border-t border-outline-variant flex justify-between items-center">
                <div className={`flex items-center gap-sm ${task.isOverdue ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                  {task.isOverdue ? <AlertTriangle size={16} /> : <CalendarDays size={16} />}
                  <span className="text-label-md">{task.date}</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="text-label-md font-bold text-on-surface">{task.submissions}</span>
                  <span className="text-label-sm font-medium text-on-surface-variant">Entregas</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
