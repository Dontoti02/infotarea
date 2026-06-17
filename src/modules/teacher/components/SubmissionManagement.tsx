"use client";

import React, { useState, useEffect } from "react";
import { 
  ChevronRight, 
  Download, 
  Search, 
  FileText, 
  CheckCircle2, 
  Eye, 
  ChevronLeft, 
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  BookOpen,
  Filter
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export function SubmissionManagement() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTaskId = searchParams.get("task_id");

  const [courses, setCourses] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all, pending, reviewed, missing
  
  const supabase = createClient();

  // Load initial courses assigned to teacher
  useEffect(() => {
    async function loadCourses() {
      setLoadingCourses(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("courses")
          .select("id, name, section")
          .eq("teacher_id", user.id)
          .order("name", { ascending: true });

        if (error) throw error;
        
        if (data && data.length > 0) {
          setCourses(data);
          
          // If we have an initial task ID from query param, find its course
          if (initialTaskId) {
            const { data: taskData } = await supabase
              .from("tasks")
              .select("course_id")
              .eq("id", initialTaskId)
              .single();
              
            if (taskData) {
              setSelectedCourseId(taskData.course_id);
              setSelectedTaskId(initialTaskId);
              return;
            }
          }
          
          setSelectedCourseId(data[0].id);
        }
      } catch (err) {
        console.error("Error loading courses:", err);
      } finally {
        setLoadingCourses(false);
      }
    }
    loadCourses();
  }, [initialTaskId]);

  // Load tasks when course changes
  useEffect(() => {
    if (!selectedCourseId) return;

    async function loadTasks() {
      setLoadingTasks(true);
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, due_date, description")
          .eq("course_id", selectedCourseId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setTasks(data || []);
        
        // If we didn't set task ID via initialTaskId (or course changed by user), select the first task
        if (data && data.length > 0) {
          if (!initialTaskId || (data.findIndex(t => t.id === selectedTaskId) === -1)) {
            setSelectedTaskId(data[0].id);
          }
        } else {
          setSelectedTaskId("");
        }
      } catch (err) {
        console.error("Error loading tasks:", err);
      } finally {
        setLoadingTasks(false);
      }
    }
    loadTasks();
  }, [selectedCourseId]);

  // Load students and submissions when task changes
  useEffect(() => {
    if (!selectedTaskId || !selectedCourseId) {
      setStudents([]);
      setSubmissions([]);
      return;
    }

    async function loadSubmissionsAndStudents() {
      setLoadingData(true);
      try {
        // 1. Fetch student members of this course
        let members: any[] | null = null;
        let membersError: any = null;

        const resWithEmail = await supabase
          .from("course_members")
          .select(`
            profile_id,
            profiles (
              id,
              full_name,
              avatar_url,
              role,
              email
            )
          `)
          .eq("course_id", selectedCourseId);

        if (resWithEmail.error && resWithEmail.error.message.includes("email")) {
          console.warn("profiles.email does not exist. Using fallback query without email.");
          const resFallback = await supabase
            .from("course_members")
            .select(`
              profile_id,
              profiles (
                id,
                full_name,
                avatar_url,
                role
              )
            `)
            .eq("course_id", selectedCourseId);
          
          members = resFallback.data;
          membersError = resFallback.error;
        } else {
          members = resWithEmail.data;
          membersError = resWithEmail.error;
        }

        if (membersError) {
          throw new Error("Error al cargar los miembros del curso: " + membersError.message);
        }

        // 2. Fetch all submissions for this task
        const { data: subs, error: subsError } = await supabase
          .from("submissions")
          .select("*")
          .eq("task_id", selectedTaskId);

        if (subsError) {
          throw new Error("Error al cargar las entregas: " + subsError.message);
        }

        // Filter only students in Javascript to be extremely robust
        const studentProfiles = (members || [])
          .map((m: any) => m.profiles)
          .filter((p: any) => p && p.role === "student");

        setStudents(studentProfiles);
        setSubmissions(subs || []);
      } catch (err: any) {
        console.error("Error loading submissions/students:", err.message || err);
      } finally {
        setLoadingData(false);
      }
    }
    loadSubmissionsAndStudents();
  }, [selectedTaskId, selectedCourseId]);

  // Get course & task object details
  const currentCourse = courses.find(c => c.id === selectedCourseId);
  const currentTask = tasks.find(t => t.id === selectedTaskId);

  // Combine student details with submission details
  const studentSubmissions = students.map(student => {
    const sub = submissions.find(s => s.student_id === student.id);
    
    // Status definitions:
    // - reviewed: Grade entered
    // - pending: Handed in but needs review
    // - missing: Not submitted
    let status = "missing";
    let score = null;
    let fileUrl = null;
    let fileName = null;
    let date = null;
    let submissionId = null;

    if (sub) {
      status = sub.status; // pending or reviewed
      score = sub.score;
      fileUrl = sub.file_url;
      fileName = sub.file_name;
      date = sub.created_at;
      submissionId = sub.id;
    }

    return {
      studentId: student.id,
      name: student.full_name,
      email: student.email,
      avatarUrl: student.avatar_url,
      status,
      score,
      fileUrl,
      fileName,
      date,
      submissionId
    };
  });

  // Filter students based on active tab and search query
  const filteredSubmissions = studentSubmissions.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (sub.email && sub.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (activeFilter === "pending") return sub.status === "pending";
    if (activeFilter === "reviewed") return sub.status === "reviewed";
    if (activeFilter === "missing") return sub.status === "missing";
    
    return true;
  });

  // KPI Counts
  const totalCount = studentSubmissions.length;
  const pendingCount = studentSubmissions.filter(s => s.status === "pending").length;
  const reviewedCount = studentSubmissions.filter(s => s.status === "reviewed").length;
  const missingCount = studentSubmissions.filter(s => s.status === "missing").length;

  const handleExportGrades = () => {
    // Generate CSV data
    const headers = ["Estudiante", "Correo", "Estado de Entrega", "Fecha", "Calificación (100)"];
    const rows = studentSubmissions.map(s => [
      s.name,
      s.email || "-",
      s.status === "reviewed" ? "Calificado" : s.status === "pending" ? "Pendiente" : "Sin entregar",
      s.date ? new Date(s.date).toLocaleDateString() : "-",
      s.score !== null ? s.score : "-"
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Notas_${currentCourse?.name || "Curso"}_${currentTask?.title || "Tarea"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getInitials = (name: string) => name?.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "?";

  if (loadingCourses) {
    return (
      <div className="flex justify-center items-center py-20 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-body-md text-on-surface-variant font-bold">Cargando cursos y entregas...</p>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center shadow-sm">
        <AlertCircle size={48} className="mx-auto text-outline-variant mb-4" />
        <h3 className="text-title-lg font-bold text-on-surface mb-2">Sin cursos asignados</h3>
        <p className="text-body-md text-on-surface-variant max-w-md mx-auto">
          No tienes cursos asignados actualmente. Contacta al administrador para que te asigne tus asignaturas, grados y secciones correspondientes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {/* Course and Task Selector Header */}
      <div className="bg-surface-container-lowest p-lg rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col md:flex-row gap-lg justify-between items-stretch">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-md">
          {/* Select Course */}
          <div className="space-y-xs">
            <label className="text-label-sm font-bold text-primary uppercase tracking-wider block">Asignatura / Curso</label>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSearchQuery("");
                setActiveFilter("all");
              }}
              className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-bold text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name} - Seccion {c.section}</option>
              ))}
            </select>
          </div>

          {/* Select Task */}
          <div className="space-y-xs">
            <label className="text-label-sm font-bold text-primary uppercase tracking-wider block">Actividad / Tarea</label>
            {loadingTasks ? (
              <div className="h-10 px-md flex items-center bg-surface border border-outline-variant rounded-xl text-on-surface-variant gap-2">
                <Loader2 className="animate-spin text-primary" size={16} />
                <span className="text-body-md font-medium">Cargando tareas del curso...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="h-10 px-md flex items-center justify-between bg-surface border border-outline-variant rounded-xl text-on-surface-variant">
                <span className="text-body-md font-medium text-error">Sin tareas creadas</span>
                <Link href="/teacher/tareas/nueva" className="text-label-sm font-bold text-primary hover:underline">
                  Crear Tarea
                </Link>
              </div>
            ) : (
              <select
                value={selectedTaskId}
                onChange={(e) => {
                  setSelectedTaskId(e.target.value);
                  setSearchQuery("");
                  setActiveFilter("all");
                }}
                className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-bold text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
              >
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {currentTask && (
          <div className="flex items-end justify-start md:justify-end shrink-0">
            <button
              onClick={handleExportGrades}
              className="flex items-center justify-center gap-2 px-md py-3 bg-surface-container-low border border-outline-variant text-primary rounded-xl hover:bg-surface-container transition-all font-bold text-label-md w-full md:w-auto shadow-sm"
            >
              <FileSpreadsheet size={18} />
              Exportar Notas
            </button>
          </div>
        )}
      </div>

      {currentTask ? (
        <>
          {/* Header Title with Dates */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
            <div>
              <div className="flex items-center gap-xs text-on-surface-variant mb-xs">
                <span className="text-label-md font-bold text-primary">{currentCourse?.name}</span>
                <ChevronRight size={14} className="text-outline" />
                <span className="text-label-md font-bold text-on-surface-variant">Sección {currentCourse?.section}</span>
              </div>
              <h2 className="text-headline-md font-bold text-on-surface leading-tight">
                Revisiones: {currentTask.title}
              </h2>
              {currentTask.due_date && (
                <p className="text-body-md text-on-surface-variant flex items-center gap-sm mt-xs">
                  <Clock size={16} className="text-primary" />
                  <span>Fecha límite de entrega: {new Date(currentTask.due_date).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}</span>
                </p>
              )}
            </div>
          </div>

          {/* Submissions KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
            {[
              { label: "Total Alumnos", value: totalCount, style: "bg-surface-container-lowest border-outline-variant/30 text-on-surface" },
              { label: "Por Revisar", value: pendingCount, style: "bg-primary-container/10 border-primary/20 text-primary" },
              { label: "Calificados", value: reviewedCount, style: "bg-secondary-container/10 border-secondary/20 text-secondary" },
              { label: "Sin Entregar", value: missingCount, style: "bg-error-container/10 border-error/20 text-error" }
            ].map((kpi, idx) => (
              <div key={idx} className={`p-md rounded-2xl border shadow-sm flex flex-col gap-xs ${kpi.style}`}>
                <span className="text-label-sm font-bold uppercase tracking-wider opacity-85">{kpi.label}</span>
                <span className="text-headline-md font-black">{kpi.value}</span>
              </div>
            ))}
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col lg:flex-row justify-between gap-md items-stretch lg:items-center bg-surface-container-lowest p-md rounded-2xl shadow-sm border border-outline-variant/30">
            <div className="flex flex-wrap gap-sm">
              {[
                { id: "all", label: "Todos", count: totalCount },
                { id: "pending", label: "Por Revisar", count: pendingCount },
                { id: "reviewed", label: "Calificados", count: reviewedCount },
                { id: "missing", label: "Sin Entregar", count: missingCount }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setActiveFilter(btn.id)}
                  className={`px-md py-sm rounded-xl font-bold text-label-md transition-all shadow-sm ${
                    activeFilter === btn.id
                      ? "bg-primary text-on-primary border border-primary"
                      : "bg-surface text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  {btn.label} ({btn.count})
                </button>
              ))}
            </div>
            
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4.5 h-4.5" />
              <input
                className="w-full pl-10 pr-sm py-sm rounded-xl border border-outline-variant bg-surface text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
                placeholder="Buscar estudiante..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Data Table */}
          {loadingData ? (
            <div className="flex justify-center items-center py-20 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-body-md text-on-surface-variant font-bold">Cargando lista de entregas...</p>
              </div>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-12 text-center shadow-sm">
              <AlertCircle size={40} className="mx-auto text-outline-variant mb-3" />
              <p className="text-body-lg font-bold text-on-surface">No se encontraron entregas</p>
              <p className="text-body-md text-on-surface-variant mt-1">Intenta ajustando los filtros de búsqueda.</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                      <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Fecha de entrega</th>
                      <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Archivo / Respuesta</th>
                      <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Estado</th>
                      <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Calificación</th>
                      <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md text-on-surface">
                    {filteredSubmissions.map((sub, index) => (
                      <tr 
                        key={sub.studentId} 
                        className="border-b border-outline-variant/50 hover:bg-surface-container-low/40 transition-colors group last:border-0"
                      >
                        {/* Student Name */}
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-sm">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-outline-variant">
                              {sub.avatarUrl ? (
                                <img src={sub.avatarUrl} alt={sub.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-bold text-primary text-label-md">{getInitials(sub.name)}</span>
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-on-surface block leading-tight">{sub.name}</span>
                              <span className="text-label-sm text-on-surface-variant">{sub.email || "Sin correo"}</span>
                            </div>
                          </div>
                        </td>

                        {/* Submission Date */}
                        <td className="px-lg py-md font-medium text-on-surface-variant">
                          {sub.date ? (
                            new Date(sub.date).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
                          ) : (
                            <span className="text-outline-variant italic">Sin registrar</span>
                          )}
                        </td>

                        {/* Attached File/Response */}
                        <td className="px-lg py-md">
                          {sub.fileUrl ? (
                            <a 
                              href={sub.fileUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-primary hover:underline cursor-pointer font-bold text-body-md w-fit"
                            >
                              <FileText size={18} />
                              <span className="max-w-[200px] truncate">{sub.fileName || "Archivo adjunto"}</span>
                            </a>
                          ) : sub.date ? (
                            <span className="flex items-center gap-1.5 text-on-surface-variant font-medium text-body-md">
                              <FileText size={18} className="text-outline-variant" />
                              Respuesta en texto
                            </span>
                          ) : (
                            <span className="text-outline-variant italic">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-lg py-md">
                          {sub.status === "reviewed" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold bg-teal-50 border border-teal-200 text-teal-800">
                              <CheckCircle2 size={14} />
                              Calificado
                            </span>
                          ) : sub.status === "pending" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold bg-primary-container/20 border border-primary/20 text-primary">
                              <Clock size={14} className="animate-pulse" />
                              Por revisar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold bg-error-container/20 border border-error/20 text-error">
                              <AlertCircle size={14} />
                              Sin entregar
                            </span>
                          )}
                        </td>

                        {/* Score */}
                        <td className="px-lg py-md">
                          {sub.score !== null ? (
                            <span className={`text-title-md font-black ${sub.score >= 70 ? 'text-secondary' : sub.score >= 50 ? 'text-amber-600' : 'text-error'}`}>
                              {sub.score} / 100
                            </span>
                          ) : (
                            <span className="text-outline-variant italic font-medium">--</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-lg py-md text-right">
                          {sub.status === "missing" ? (
                            <button 
                              disabled 
                              className="px-md py-1.5 rounded-xl border border-outline-variant text-outline bg-surface-container-low font-bold text-label-md transition-all opacity-50 cursor-not-allowed"
                            >
                              Sin Entrega
                            </button>
                          ) : sub.status === "reviewed" ? (
                            <Link
                              href={`/teacher/entregas/${sub.submissionId}`}
                              className="inline-flex items-center gap-1.5 px-md py-1.5 rounded-xl border border-secondary text-secondary hover:bg-surface-container-low font-bold text-label-md transition-all shadow-sm"
                            >
                              <Eye size={16} />
                              Ver Nota
                            </Link>
                          ) : (
                            <Link
                              href={`/teacher/entregas/${sub.submissionId}`}
                              className="inline-flex items-center gap-1.5 px-md py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-bold text-label-md transition-all shadow-sm"
                            >
                              Revisar
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-12 text-center shadow-sm">
          <BookOpen size={48} className="mx-auto text-outline-variant mb-4" />
          <h3 className="text-title-lg font-bold text-on-surface mb-2">No hay tareas</h3>
          <p className="text-body-md text-on-surface-variant max-w-md mx-auto mb-6">
            Aún no has creado ninguna tarea en este curso. Crea tu primera tarea para que los alumnos comiencen a entregar sus soluciones.
          </p>
          <Link
            href="/teacher/tareas/nueva"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm"
          >
            Crear Nueva Tarea
          </Link>
        </div>
      )}
    </div>
  );
}
