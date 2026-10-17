"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  RefreshCw, 
  Trophy, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Star, 
  Edit3, 
  ChevronRight, 
  User, 
  Users,
  Check, 
  X,
  BookOpen,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Course {
  id: string;
  name: string;
  section: string;
}

interface Student {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email?: string;
  courseSection: string | null;
  courses: Course[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    pendingReviews: number;
    averageScore: number;
    performance: "Excelente" | "Aprobado" | "En riesgo" | "Sin actividad";
  };
}

// Estilos por nivel de rendimiento (reutilizados en la lista y el detalle)
const PERFORMANCE_STYLES: Record<Student["stats"]["performance"], { chip: string; dot: string }> = {
  Excelente: { chip: "bg-secondary-container/30 text-on-secondary-container", dot: "bg-secondary" },
  Aprobado: { chip: "bg-primary/10 text-primary", dot: "bg-primary" },
  "En riesgo": { chip: "bg-error/10 text-error", dot: "bg-error" },
  "Sin actividad": { chip: "bg-surface-container text-on-surface-variant", dot: "bg-outline-variant" },
};

const PERFORMANCE_FILTERS = [
  { value: "all", label: "Todos", dot: "" },
  { value: "Excelente", label: "Excelente", dot: "bg-secondary" },
  { value: "Aprobado", label: "Aprobado", dot: "bg-primary" },
  { value: "En riesgo", label: "En riesgo", dot: "bg-error" },
  { value: "Sin actividad", label: "Sin actividad", dot: "bg-outline-variant" },
] as const;

const SORT_OPTIONS: { key: "name" | "score" | "progress"; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "score", label: "Calificación" },
  { key: "progress", label: "Progreso" },
];

export function AdminAcademicTracking() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "score" | "progress">("name");

  // Selection & Interactivity
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentTasks, setStudentTasks] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Grading Modal/State
  const [gradingTask, setGradingTask] = useState<any | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  // Database Client
  const supabase = createClient();

  // Load all tracking data
  const loadTrackingData = async (selectStudentIdAfterLoad?: string) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch profiles with their course memberships and joined courses
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          avatar_url,
          email,
          course_members (
            courses (
              id,
              name,
              section
            )
          )
        `)
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      // 2. Fetch all tasks and their courses
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, due_date, task_type, course_id, courses(name, section)");

      if (tasksError) throw tasksError;

      // 3. Fetch all submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from("submissions")
        .select("id, task_id, student_id, score, status, feedback");

      if (submissionsError) throw submissionsError;

      // 4. Process data in memory to build stats
      const tasks = tasksData || [];
      const submissions = submissionsData || [];

      const processedStudents: Student[] = (profilesData || []).map((profile: any) => {
        // Extract courses
        const courses: Course[] = (profile.course_members || [])
          .map((m: any) => m.courses)
          .filter((c: any) => c !== null);

        const courseIds = courses.map(c => c.id);
        const courseSection = courses[0]?.section || null;
        const email = profile.email || "";

        // Filter tasks assigned to student's courses
        const assignedTasks = tasks.filter(t => courseIds.includes(t.course_id));
        const totalTasks = assignedTasks.length;

        // Filter student submissions
        const studentSubmissions = submissions.filter(s => s.student_id === profile.id);
        const completedTasks = studentSubmissions.length; // Any submission counts as turned in
        
        // Submissions pending feedback/grade
        const pendingReviews = studentSubmissions.filter(s => s.status === "pending").length;

        // Calculate average score of graded submissions (reviewed status with numeric score)
        const gradedSubmissions = studentSubmissions.filter(
          s => s.status === "reviewed" && s.score !== null && s.score !== undefined
        );
        const totalScore = gradedSubmissions.reduce((sum, s) => sum + Number(s.score), 0);
        const averageScore = gradedSubmissions.length > 0 ? Number((totalScore / gradedSubmissions.length).toFixed(1)) : 0;

        // Determine performance level
        let performance: Student["stats"]["performance"] = "Sin actividad";
        if (completedTasks > 0) {
          if (averageScore >= 8.5) performance = "Excelente";
          else if (averageScore >= 5.0) performance = "Aprobado";
          else performance = "En riesgo";
        }

        return {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          email,
          courseSection,
          courses,
          stats: {
            totalTasks,
            completedTasks,
            pendingReviews,
            averageScore,
            performance
          }
        };
      });

      setStudents(processedStudents);

      // Restore selected student details if applicable
      if (selectStudentIdAfterLoad) {
        const found = processedStudents.find(s => s.id === selectStudentIdAfterLoad);
        if (found) {
          setSelectedStudent(found);
          await loadStudentDetails(found, tasks, submissions);
        }
      } else if (selectedStudent) {
        const found = processedStudents.find(s => s.id === selectedStudent.id);
        if (found) {
          setSelectedStudent(found);
          await loadStudentDetails(found, tasks, submissions);
        }
      }
    } catch (err: any) {
      console.error("Error loading tracking data:", err);
      setError(err.message || "Error al cargar la información de seguimiento académico.");
    } finally {
      setLoading(false);
    }
  };

  // Load detailed tasks and submission states for the selected student
  const loadStudentDetails = async (student: Student, allTasks?: any[], allSubmissions?: any[]) => {
    try {
      setLoadingDetails(true);
      let tasks = allTasks;
      let submissions = allSubmissions;

      // If not passed in, fetch them specifically
      if (!tasks || !submissions) {
        const courseIds = student.courses.map(c => c.id);
        
        const { data: tData } = await supabase
          .from("tasks")
          .select("id, title, due_date, task_type, course_id, courses(name, section)")
          .in("course_id", courseIds.length > 0 ? courseIds : ["00000000-0000-0000-0000-000000000000"]);
          
        const { data: sData } = await supabase
          .from("submissions")
          .select("id, task_id, student_id, score, status, feedback")
          .eq("student_id", student.id);

        tasks = tData || [];
        submissions = sData || [];
      }

      // Map tasks to their corresponding submission details
      const studentCoursesIds = student.courses.map(c => c.id);
      const studentAssignedTasks = tasks.filter(t => studentCoursesIds.includes(t.course_id));

      const detailedTasks = studentAssignedTasks.map(task => {
        const submission = submissions.find(s => s.task_id === task.id && s.student_id === student.id);
        return {
          id: task.id,
          title: task.title,
          task_type: task.task_type,
          due_date: task.due_date,
          courseName: task.courses?.name || "Curso Desconocido",
          courseSection: task.courses?.section || "",
          submissionId: submission?.id || null,
          score: submission?.score || null,
          status: submission ? submission.status : "not_submitted", // reviewed, pending, not_submitted
          feedback: submission?.feedback || ""
        };
      });

      // Sort by due date (newest first)
      detailedTasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      });

      setStudentTasks(detailedTasks);
    } catch (err) {
      console.error("Error loading student details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadTrackingData();
  }, []);

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    await loadStudentDetails(student);
  };

  // Open grading modal/panel
  const handleOpenGrading = (task: any) => {
    setGradingTask(task);
    setScoreInput(task.score !== null ? task.score.toString() : "");
    setFeedbackInput(task.feedback || "");
    setGradingError(null);
  };

  // Save the score and feedback to Supabase
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingTask || !selectedStudent) return;
    
    setSavingGrade(true);
    setGradingError(null);

    const score = scoreInput.trim() === "" ? null : parseFloat(scoreInput);
    
    if (score !== null && (isNaN(score) || score < 0 || score > 10)) {
      setGradingError("La nota debe estar entre 0 y 10.");
      setSavingGrade(false);
      return;
    }

    try {
      if (gradingTask.submissionId) {
        // Update existing submission
        const { error: updateError } = await supabase
          .from("submissions")
          .update({
            score: score,
            feedback: feedbackInput.trim() || null,
            status: "reviewed"
          })
          .eq("id", gradingTask.submissionId);

        if (updateError) throw updateError;
      } else {
        // Create a new submission record (graded by teacher directly)
        const { error: insertError } = await supabase
          .from("submissions")
          .insert({
            task_id: gradingTask.id,
            student_id: selectedStudent.id,
            score: score,
            feedback: feedbackInput.trim() || null,
            status: "reviewed",
            content: "Calificado directamente por el Administrador"
          });

        if (insertError) throw insertError;
      }

      // Close modal and reload data
      setGradingTask(null);
      await loadTrackingData(selectedStudent.id);
    } catch (err: any) {
      console.error("Error saving grade:", err);
      setGradingError(err.message || "Error al registrar la calificación.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Get unique grades/sections for filtering
  const sections = Array.from(
    new Set(students.map(s => s.courseSection).filter((s): s is string => s !== null))
  ).sort();

  // Filter & Sort logic
  const filteredStudents = students
    .filter(student => {
      const matchesSearch = 
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesSection = sectionFilter === "all" || student.courseSection === sectionFilter;
      
      const matchesStatus = statusFilter === "all" || student.stats.performance === statusFilter;

      return matchesSearch && matchesSection && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "score") {
        return b.stats.averageScore - a.stats.averageScore;
      }
      if (sortBy === "progress") {
        const aProg = a.stats.totalTasks > 0 ? (a.stats.completedTasks / a.stats.totalTasks) : 0;
        const bProg = b.stats.totalTasks > 0 ? (b.stats.completedTasks / b.stats.totalTasks) : 0;
        return bProg - aProg;
      }
      return a.full_name.localeCompare(b.full_name);
    });

  // Resumen general para el monitoreo (calculado con los datos ya cargados)
  const studentsWithActivity = students.filter(s => s.stats.completedTasks > 0);
  const studentsAtRisk = students.filter(s => s.stats.performance === "En riesgo");
  const pendingReviewsTotal = students.reduce((sum, s) => sum + s.stats.pendingReviews, 0);
  const generalAverage = studentsWithActivity.length > 0
    ? (studentsWithActivity.reduce((sum, s) => sum + s.stats.averageScore, 0) / studentsWithActivity.length).toFixed(1)
    : "—";

  const summaryCards = [
    {
      label: "Estudiantes",
      value: students.length,
      hint: `${studentsWithActivity.length} con entregas`,
      icon: <Users size={18} />,
      tone: "bg-primary/10 text-primary"
    },
    {
      label: "Por calificar",
      value: pendingReviewsTotal,
      hint: "entregas pendientes",
      icon: <Clock size={18} />,
      tone: "bg-amber-400/20 text-amber-600 dark:text-amber-300"
    },
    {
      label: "En riesgo",
      value: studentsAtRisk.length,
      hint: "necesitan apoyo",
      icon: <AlertTriangle size={18} />,
      tone: "bg-error/10 text-error"
    },
    {
      label: "Promedio general",
      value: generalAverage,
      hint: "escala 0 a 10",
      icon: <Trophy size={18} />,
      tone: "bg-tertiary/10 text-tertiary"
    },
  ];

  if (loading) {
    return (
      <div className="space-y-lg animate-fade-in">
        {/* Esqueletos del resumen */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-sm md:gap-md">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-md">
              <div className="flex items-center gap-sm">
                <div className="w-9 h-9 rounded-xl bg-surface-container animate-pulse" />
                <div className="h-3 w-20 rounded-full bg-surface-container animate-pulse" />
              </div>
              <div className="h-7 w-16 rounded-lg bg-surface-container animate-pulse mt-md" />
            </div>
          ))}
        </div>

        {/* Esqueletos de las dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-lg space-y-md">
              <div className="h-5 w-32 rounded-full bg-surface-container animate-pulse" />
              <div className="h-11 w-full rounded-xl bg-surface-container animate-pulse" />
              <div className="h-11 w-full rounded-xl bg-surface-container animate-pulse" />
              <div className="space-y-sm pt-sm">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 w-full rounded-xl bg-surface-container-low animate-pulse" />
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-xl min-h-[28rem] flex items-center justify-center">
              <div className="flex flex-col items-center gap-md">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/25 border-t-primary" />
                <p className="text-body-md font-medium text-on-surface-variant">Cargando panel de seguimiento académico...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-lg animate-fade-in relative">
      
      {/* Grading Modal */}
      {gradingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[28rem] relative overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary-container to-secondary" />

            <div className="flex items-start justify-between gap-md px-6 pt-5 pb-4 border-b border-outline-variant/40">
              <div className="flex items-center gap-md min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Star size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-title-lg font-bold text-on-surface">Evaluar actividad</h3>
                  <p className="text-label-sm text-on-surface-variant max-w-[18rem] truncate">{gradingTask.title}</p>
                  {selectedStudent && (
                    <p className="text-label-sm text-primary font-semibold truncate max-w-[18rem]">{selectedStudent.full_name}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setGradingTask(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-6 space-y-4">
              {gradingError && (
                <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
                  <AlertCircle size={16} /> {gradingError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-label-md font-bold text-on-surface flex justify-between gap-sm">
                  <span>Nota (escala 0 - 10)</span>
                  <span className="text-primary font-medium text-label-sm">Decimales permitidos (ej. 8.5)</span>
                </label>
                <input
                  type="text"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="Ej: 9.2 (Dejar vacío para borrar calificación)"
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/50 rounded-xl text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-md font-bold text-on-surface">Retroalimentación para el estudiante</label>
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Escribe comentarios sobre la entrega..."
                  rows={4}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/50 rounded-xl text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setGradingTask(null)} 
                  className="flex-1 py-3 rounded-xl border border-outline-variant/60 text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingGrade} 
                  className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {savingGrade ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                  {savingGrade ? "Guardando..." : "Guardar nota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-error/10 border border-error/20 text-error p-lg rounded-2xl flex items-start gap-md">
          <div className="w-10 h-10 rounded-xl bg-error/15 grid place-items-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="font-bold text-body-lg">No se pudo cargar el seguimiento</h4>
            <p className="text-body-md mt-xs">{error}</p>
            <button 
              onClick={() => loadTrackingData()} 
              className="mt-sm bg-error text-on-error text-label-md font-bold px-3.5 py-2 rounded-xl hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Reintentar carga
            </button>
          </div>
        </div>
      )}

      {/* Resumen general para monitoreo rápido */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-sm md:gap-md">
        {summaryCards.map(card => (
          <div
            key={card.label}
            className="relative overflow-hidden bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-md hover:shadow-md transition-shadow"
          >
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/5" />
            <div className="relative flex items-center gap-sm">
              <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${card.tone}`}>
                {card.icon}
              </div>
              <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant truncate">
                {card.label}
              </span>
            </div>
            <div className="relative flex items-baseline gap-xs mt-md">
              <span className="text-headline-md font-bold text-on-surface tabular-nums">{card.value}</span>
              <span className="text-label-sm text-on-surface-variant truncate">{card.hint}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Layout principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        
        {/* Left column: Filters & Student list (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 p-lg space-y-md">
            
            {/* Encabezado de la lista */}
            <div className="flex items-center justify-between gap-sm">
              <div className="min-w-0">
                <h3 className="text-title-lg font-bold text-on-surface">Estudiantes</h3>
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  Mostrando {filteredStudents.length} de {students.length}
                </p>
              </div>
              <button 
                onClick={() => loadTrackingData()} 
                className="w-9 h-9 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors shrink-0"
                title="Sincronizar datos"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant/50 rounded-xl text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Filtro por sección */}
            <div className="space-y-xs">
              <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Grado / Sección</span>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/50 rounded-xl text-body-md font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="all">Todos ({sections.length})</option>
                {sections.map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>

            {/* Filtro por rendimiento */}
            <div className="space-y-xs">
              <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Rendimiento</span>
              <div className="flex flex-wrap gap-xs">
                {PERFORMANCE_FILTERS.map(option => {
                  const isActive = statusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value)}
                      aria-pressed={isActive}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-bold border transition-colors ${
                        isActive
                          ? "bg-primary text-on-primary border-primary shadow-sm"
                          : "bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:border-primary/40 hover:text-on-surface"
                      }`}
                    >
                      {option.dot && <span className={`w-1.5 h-1.5 rounded-full ${option.dot}`} />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-label-sm text-on-surface-variant/80">
                Excelente ≥ 8.5 · Aprobado ≥ 5.0 · En riesgo &lt; 5.0
              </p>
            </div>

            {/* Orden */}
            <div className="flex flex-wrap gap-sm items-center justify-between pt-md border-t border-outline-variant/20">
              <span className="text-label-sm font-medium text-on-surface-variant">Ordenar por</span>
              <div className="flex gap-1 bg-surface-container-low rounded-full p-1">
                {SORT_OPTIONS.map(option => {
                  const isActive = sortBy === option.key;
                  return (
                    <button
                      key={option.key}
                      onClick={() => setSortBy(option.key)}
                      aria-pressed={isActive}
                      className={`px-3 py-1.5 rounded-full text-label-sm font-bold transition-colors ${
                        isActive
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Lista de estudiantes */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="p-xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container grid place-items-center mb-md">
                  <User size={26} className="text-on-surface-variant/60" />
                </div>
                <p className="text-body-md font-bold text-on-surface">No se encontraron estudiantes</p>
                <p className="text-label-md text-on-surface-variant mt-xs">
                  Ajusta la búsqueda o los filtros para ver resultados.
                </p>
              </div>
            ) : (
              <div className="max-h-[34rem] overflow-y-auto p-sm space-y-xs">
                {filteredStudents.map(student => {
                  const isSelected = selectedStudent?.id === student.id;
                  const progressPercentage = student.stats.totalTasks > 0 
                    ? Math.round((student.stats.completedTasks / student.stats.totalTasks) * 100) 
                    : 0;
                  const tone = PERFORMANCE_STYLES[student.stats.performance];
                  const scoreTone = student.stats.averageScore >= 8.5
                    ? "bg-secondary-container/30 text-secondary"
                    : student.stats.averageScore >= 5.0
                    ? "bg-primary/10 text-primary"
                    : "bg-error/10 text-error";

                  return (
                    <button
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className={`w-full text-left p-sm md:p-md rounded-xl border flex items-center gap-md transition-all ${
                        isSelected
                          ? "bg-primary/5 border-primary/40 shadow-sm"
                          : "border-transparent hover:bg-surface-container-low hover:border-outline-variant/30"
                      }`}
                    >
                      {/* Avatar con color según rendimiento */}
                      <div className={`w-10 h-10 rounded-full grid place-items-center font-bold shrink-0 ${tone.chip}`}>
                        {student.full_name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-label-md font-bold text-on-surface truncate">{student.full_name}</h4>
                        <p className="text-label-sm text-on-surface-variant truncate">{student.email}</p>
                        <div className="flex flex-wrap items-center gap-xs mt-1">
                          {student.courseSection && (
                            <span className="text-[10px] font-bold bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">
                              {student.courseSection}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-on-surface-variant">
                            {student.stats.completedTasks} / {student.stats.totalTasks} tareas
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${tone.chip}`}>
                            <span className={`w-1 h-1 rounded-full ${tone.dot}`} />
                            {student.stats.performance}
                          </span>
                        </div>
                      </div>

                      {/* Nota y avance */}
                      <div className="flex flex-col items-end shrink-0 gap-sm">
                        {student.stats.completedTasks > 0 ? (
                          <span className={`inline-flex items-center gap-0.5 font-bold text-label-md px-2 py-0.5 rounded-full tabular-nums ${scoreTone}`}>
                            <Star size={12} fill="currentColor" /> {student.stats.averageScore}
                          </span>
                        ) : (
                          <span className="text-label-sm font-semibold text-on-surface-variant/50">Sin notas</span>
                        )}
                        <div className="w-16 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${tone.dot}`}
                            style={{ width: `${progressPercentage}%` }} 
                          />
                        </div>
                      </div>

                      <ChevronRight
                        size={16}
                        className={`shrink-0 transition-transform ${isSelected ? "text-primary translate-x-0.5" : "text-on-surface-variant/40"}`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detalle del estudiante (7 col en lg) */}
        <div className="lg:col-span-7">
          {!selectedStudent ? (
            <div className="relative overflow-hidden bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 p-xl flex flex-col items-center justify-center text-center min-h-[30rem]">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-primary/10 to-transparent" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-tr from-secondary/10 to-transparent" />
              <div className="relative w-20 h-20 rounded-3xl bg-primary/10 text-primary grid place-items-center mb-lg">
                <BookOpen size={36} />
              </div>
              <h3 className="relative text-headline-md font-bold text-on-surface mb-xs">Consola de seguimiento</h3>
              <p className="relative text-body-md text-on-surface-variant max-w-[24rem]">
                Selecciona un estudiante de la lista para analizar su progreso, revisar sus actividades y calificarlas.
              </p>
              <div className="relative mt-lg flex flex-wrap items-center justify-center gap-sm">
                <span className="inline-flex items-center gap-1.5 text-label-sm font-bold px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant/40">
                  <FileText size={14} /> Revisa sus entregas
                </span>
                <span className="inline-flex items-center gap-1.5 text-label-sm font-bold px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant/40">
                  <Star size={14} /> Califica en un clic
                </span>
                <span className="inline-flex items-center gap-1.5 text-label-sm font-bold px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant/40">
                  <AlertTriangle size={14} /> Detecta casos en riesgo
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-lg">
              
              {/* Encabezado del estudiante */}
              <div className="relative overflow-hidden bg-surface-container-lowest rounded-2xl shadow-sm p-lg flex flex-col sm:flex-row items-center sm:items-start gap-lg border border-outline-variant/40">
                <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-primary/10 to-transparent" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary text-headline-md font-extrabold flex items-center justify-center shadow-md shrink-0">
                  {selectedStudent.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="relative flex-1 text-center sm:text-left min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-sm justify-center sm:justify-start">
                    <h3 className="text-headline-md font-bold text-on-surface truncate">{selectedStudent.full_name}</h3>
                    <span className={`inline-flex self-center items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${PERFORMANCE_STYLES[selectedStudent.stats.performance].chip}`}>
                      <span className={`w-1 h-1 rounded-full ${PERFORMANCE_STYLES[selectedStudent.stats.performance].dot}`} />
                      {selectedStudent.stats.performance}
                    </span>
                  </div>
                  <p className="text-body-md text-on-surface-variant font-medium mt-0.5">
                    {selectedStudent.courseSection ? `${selectedStudent.courseSection} - Educación Secundaria` : 'Sección no asignada'}
                  </p>
                  <p className="text-label-sm text-on-surface-variant/80 mt-1 truncate">{selectedStudent.email}</p>
                  
                  {/* Asignaturas matriculadas */}
                  <div className="mt-md flex flex-wrap gap-sm justify-center sm:justify-start">
                    {selectedStudent.courses.length === 0 ? (
                      <span className="text-label-sm font-bold text-error bg-error/10 px-2.5 py-1 rounded-full">
                        No matriculado en asignaturas
                      </span>
                    ) : (
                      selectedStudent.courses.map(c => (
                        <span key={c.id} className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                          {c.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-md bg-surface-container-lowest rounded-2xl border border-outline-variant/40">
                  <div className="animate-spin rounded-full h-9 w-9 border-4 border-primary/25 border-t-primary"></div>
                  <p className="text-on-surface-variant font-medium text-body-md">Cargando actividades del estudiante...</p>
                </div>
              ) : (
                <>
                  {/* Indicadores del estudiante */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-md">

                    {/* Entregas */}
                    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md border border-outline-variant/40 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between gap-sm">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                          <FileText size={20} />
                        </div>
                        <span className="text-label-sm font-semibold text-on-surface-variant">{selectedStudent.stats.totalTasks} asignadas</span>
                      </div>
                      <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mt-md">Tareas entregadas</p>
                      <div className="flex items-baseline gap-xs">
                        <span className="text-headline-md font-bold text-on-surface tabular-nums">{selectedStudent.stats.completedTasks}</span>
                        <span className="text-label-md text-on-surface-variant">de {selectedStudent.stats.totalTasks}</span>
                      </div>
                      <div className="mt-sm h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${selectedStudent.stats.totalTasks > 0 ? Math.round((selectedStudent.stats.completedTasks / selectedStudent.stats.totalTasks) * 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Promedio */}
                    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md border border-outline-variant/40 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between gap-sm">
                        <div className="w-10 h-10 rounded-xl bg-secondary-container/30 text-secondary grid place-items-center shrink-0">
                          <Trophy size={20} />
                        </div>
                        <span className="text-label-sm font-semibold text-on-surface-variant">/ 10</span>
                      </div>
                      <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mt-md">Promedio general</p>
                      <div className="flex items-baseline gap-xs">
                        <span className="text-headline-md font-bold text-on-surface tabular-nums">
                          {selectedStudent.stats.completedTasks > 0 ? selectedStudent.stats.averageScore : "—"}
                        </span>
                        <span className="text-label-md text-on-surface-variant">según actividades revisadas</span>
                      </div>
                    </div>

                    {/* Por calificar */}
                    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md border border-outline-variant/40 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between gap-sm">
                        <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                          selectedStudent.stats.pendingReviews > 0
                            ? 'bg-amber-400/20 text-amber-600 dark:text-amber-300'
                            : 'bg-secondary-container/30 text-secondary'
                        }`}>
                          {selectedStudent.stats.pendingReviews > 0 ? <Clock size={20} /> : <CheckCircle2 size={20} />}
                        </div>
                        <span className="text-label-sm font-semibold text-on-surface-variant">
                          {selectedStudent.stats.pendingReviews === 0 ? "Al día" : "Requiere revisión"}
                        </span>
                      </div>
                      <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mt-md">Por calificar</p>
                      <div className="flex items-baseline gap-xs">
                        <span className="text-headline-md font-bold text-on-surface tabular-nums">{selectedStudent.stats.pendingReviews}</span>
                        <span className="text-label-md text-on-surface-variant">
                          {selectedStudent.stats.pendingReviews === 1 ? "entrega pendiente" : "entregas pendientes"}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Tasks and Submissions Table */}
                  <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 overflow-hidden">
                    <div className="px-lg py-md border-b border-outline-variant/30 flex flex-wrap justify-between items-center gap-sm bg-surface-container-low/60">
                      <div className="flex items-center gap-sm">
                        <div className="w-9 h-9 rounded-xl bg-secondary-container/30 text-secondary grid place-items-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div>
                          <h4 className="text-title-lg font-bold text-on-surface">Tareas &amp; calificaciones</h4>
                          <p className="text-label-sm text-on-surface-variant">Califica o edita la nota de cada actividad</p>
                        </div>
                      </div>
                      <span className="text-label-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                        {studentTasks.length} {studentTasks.length === 1 ? "tarea" : "tareas"}
                      </span>
                    </div>

                    {studentTasks.length === 0 ? (
                      <div className="p-xl text-center">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container grid place-items-center mb-md">
                          <FileText size={26} className="text-on-surface-variant/60" />
                        </div>
                        <h5 className="font-bold text-on-surface text-body-lg">Sin tareas asignadas</h5>
                        <p className="text-body-md text-on-surface-variant max-w-[22rem] mx-auto mt-xs">
                          Este estudiante no tiene tareas programadas porque su sección no cuenta con asignaturas o tareas creadas.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[42rem] text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-container-low/40 border-b border-outline-variant/30">
                              <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Actividad</th>
                              <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Materia</th>
                              <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Fecha límite</th>
                              <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider text-right">Nota</th>
                              <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider text-center">Estado</th>
                              <th className="px-lg py-md text-label-sm font-bold text-on-surface-variant uppercase tracking-wider text-center">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/15">
                            {studentTasks.map(t => {
                              let statusClass = "bg-surface-container text-on-surface-variant";
                              let statusDot = "bg-outline";
                              let statusLabel = "No entregado";
                              
                              if (t.status === "reviewed") {
                                statusClass = "bg-secondary-container/30 text-on-secondary-container";
                                statusDot = "bg-secondary";
                                statusLabel = "Revisado";
                              } else if (t.status === "pending") {
                                statusClass = "bg-amber-400/20 text-amber-700 dark:text-amber-300";
                                statusDot = "bg-amber-500";
                                statusLabel = "Por revisar";
                              }

                              return (
                                <tr key={t.id} className="hover:bg-surface-container-low/60 transition-colors">
                                  <td className="px-lg py-md">
                                    <div className="font-bold text-on-surface">{t.title}</div>
                                    <div className="flex flex-wrap items-center gap-sm mt-1">
                                      <span className="text-[10px] font-bold bg-secondary-container/30 text-on-secondary-container px-2 py-0.5 rounded-full uppercase">
                                        {t.task_type === 'homework' ? 'Tarea' : t.task_type === 'forum' ? 'Foro' : t.task_type === 'exam' ? 'Examen' : t.task_type}
                                      </span>
                                      {t.feedback && (
                                        <p className="text-label-sm text-on-surface-variant italic max-w-[16rem] truncate" title={t.feedback}>
                                          &ldquo;{t.feedback}&rdquo;
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-lg py-md text-on-surface-variant font-medium">
                                    {t.courseName}
                                  </td>
                                  <td className="px-lg py-md text-on-surface-variant whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 text-label-md font-medium">
                                      <Calendar size={13} className="opacity-70" />
                                      {t.due_date ? new Date(t.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : 'Sin límite'}
                                    </span>
                                  </td>
                                  <td className="px-lg py-md text-right font-extrabold text-on-surface tabular-nums">
                                    {t.score !== null ? t.score.toFixed(1) : "-"}
                                  </td>
                                  <td className="px-lg py-md text-center">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-bold ${statusClass}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-lg py-md text-center">
                                    <button 
                                      onClick={() => handleOpenGrading(t)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-label-sm hover:bg-primary hover:text-on-primary transition-colors"
                                      title={t.score !== null ? "Editar calificación" : "Calificar"}
                                    >
                                      <Edit3 size={14} /> {t.score !== null ? "Editar" : "Calificar"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
