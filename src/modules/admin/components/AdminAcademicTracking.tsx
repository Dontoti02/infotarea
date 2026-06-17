"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
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
  Plus, 
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
          temp_credentials (
            email
          ),
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
        const email = profile.temp_credentials?.[0]?.email || "sin_correo@infotarea.edu";

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

  // Generate complete mock academic data for testing purposes
  const handleGenerateTestData = async (student: Student) => {
    if (!confirm(`¿Deseas generar datos de prueba académicos para ${student.full_name}? Esto creará cursos, tareas y entregas ficticias.`)) {
      return;
    }

    try {
      setLoadingDetails(true);
      
      const targetSection = student.courseSection || "3A";
      
      // 1. Check if course members or courses exist. If not, generate courses.
      let { data: existingCourses } = await supabase
        .from("courses")
        .select("*")
        .eq("section", targetSection);
        
      if (!existingCourses || existingCourses.length === 0) {
        // Create 4 subjects
        const subjects = [
          { name: "Matemáticas Avanzadas", section: targetSection, image_url: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500" },
          { name: "Física y Química", section: targetSection, image_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500" },
          { name: "Lengua y Literatura", section: targetSection, image_url: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500" },
          { name: "Historia Universal", section: targetSection, image_url: "https://images.unsplash.com/photo-1461360228754-6e81c478bc88?w=500" }
        ];

        const { data: newCourses, error: cErr } = await supabase
          .from("courses")
          .insert(subjects)
          .select();
          
        if (cErr) throw cErr;
        existingCourses = newCourses;
      }

      // 2. Enroll student in these courses if not enrolled
      const currentCourseIds = student.courses.map(c => c.id);
      const coursesToEnroll = (existingCourses || []).filter(c => !currentCourseIds.includes(c.id));
      
      if (coursesToEnroll.length > 0) {
        const enrollments = coursesToEnroll.map(c => ({
          course_id: c.id,
          profile_id: student.id
        }));

        const { error: eErr } = await supabase
          .from("course_members")
          .insert(enrollments);
          
        if (eErr) throw eErr;
      }

      // Refresh list of courses
      const allCourseIds = (existingCourses || []).map(c => c.id);

      // 3. Check tasks. If none, create 2 tasks per course.
      const { data: currentTasks } = await supabase
        .from("tasks")
        .select("*")
        .in("course_id", allCourseIds);

      let tasksList = currentTasks || [];
      
      if (tasksList.length === 0) {
        const tasksToInsert: any[] = [];
        const taskTitles = [
          { title: "Examen Parcial - Unidad 1", type: "exam", desc: "Examen escrito de los conceptos fundamentales analizados en clase." },
          { title: "Práctica de Laboratorio Nro 2", type: "homework", desc: "Elaboración de informe estructurado y conclusiones de la práctica." },
          { title: "Foro de Debate Semanal", type: "forum", desc: "Publica tu opinión sobre el tema de la semana y responde a al menos dos compañeros." }
        ];

        allCourseIds.forEach(courseId => {
          taskTitles.forEach((tInfo, idx) => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() - (idx * 5) + 3); // some past, some future
            tasksToInsert.push({
              course_id: courseId,
              title: tInfo.title,
              description: tInfo.desc,
              task_type: tInfo.type,
              due_date: dueDate.toISOString()
            });
          });
        });

        const { data: newTasks, error: tErr } = await supabase
          .from("tasks")
          .insert(tasksToInsert)
          .select();

        if (tErr) throw tErr;
        tasksList = newTasks || [];
      }

      // 4. Generate submissions for the student
      const studentTasksIds = tasksList.map(t => t.id);
      const { data: currentSubmissions } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", student.id);

      const submittedTaskIds = (currentSubmissions || []).map(s => s.task_id);
      const unsubmittedTasks = tasksList.filter(t => !submittedTaskIds.includes(t.id));

      if (unsubmittedTasks.length > 0) {
        const submissionsToInsert: any[] = [];
        
        unsubmittedTasks.forEach((task, idx) => {
          // Only submit some tasks to leave others as "not submitted"
          if (idx % 3 !== 2) {
            const isReviewed = idx % 2 === 0;
            const score = isReviewed ? parseFloat((5 + Math.random() * 5).toFixed(1)) : null;
            const status = isReviewed ? "reviewed" : "pending";
            const feedback = isReviewed ? "Excelente desarrollo del tema propuesto." : null;

            submissionsToInsert.push({
              task_id: task.id,
              student_id: student.id,
              content: "https://www.google.com/drive/ficticia/archivo_entregado.pdf",
              status,
              score,
              feedback,
              created_at: new Date(new Date(task.due_date).getTime() - 86400000).toISOString() // submitted 1 day before due date
            });
          }
        });

        if (submissionsToInsert.length > 0) {
          const { error: sErr } = await supabase
            .from("submissions")
            .insert(submissionsToInsert);
            
          if (sErr) throw sErr;
        }
      }

      // Reload
      await loadTrackingData(student.id);
    } catch (err: any) {
      console.error("Error generating test data:", err);
      alert("Error al generar datos de prueba: " + err.message);
    } finally {
      setLoadingDetails(false);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        <p className="text-on-surface-variant font-medium">Cargando panel de seguimiento académico...</p>
      </div>
    );
  }

  return (
    <div className="space-y-lg animate-fade-in relative">
      
      {/* Grading Modal */}
      {gradingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[28rem] relative overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-container to-secondary" />
            
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
              <div>
                <h3 className="text-title-lg font-bold text-on-surface">Evaluar Actividad</h3>
                <p className="text-label-sm text-on-surface-variant max-w-[22rem] truncate">{gradingTask.title}</p>
              </div>
              <button 
                onClick={() => setGradingTask(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
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
                <label className="text-label-md font-bold text-on-surface flex justify-between">
                  <span>Nota (Escala 0 - 10)</span>
                  <span className="text-primary font-medium text-label-sm">Decimales permitidos (ej. 8.5)</span>
                </label>
                <input
                  type="text"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="Ej: 9.2 (Dejar vacío para borrar calificación)"
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-md font-bold text-on-surface">Retroalimentación para el estudiante</label>
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Escribe comentarios sobre la entrega..."
                  rows={4}
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setGradingTask(null)} 
                  className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingGrade} 
                  className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {savingGrade ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                  {savingGrade ? "Guardando..." : "Guardar Nota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-error/10 border border-error/20 text-error p-lg rounded-xl flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold">Ha ocurrido un error</h4>
            <p className="text-body-md mt-xs">{error}</p>
            <button 
              onClick={() => loadTrackingData()} 
              className="mt-sm bg-error text-white text-label-sm font-bold px-3 py-1.5 rounded-lg hover:bg-error-container transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Reintentar Carga
            </button>
          </div>
        </div>
      )}

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        
        {/* Left column: Filters & Student list (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-md">
          <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/30 p-lg space-y-md">
            
            {/* Search and Refresh Header */}
            <div className="flex justify-between items-center gap-sm">
              <h3 className="text-title-lg font-bold text-on-surface">Estudiantes</h3>
              <button 
                onClick={() => loadTrackingData()} 
                className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors"
                title="Sincronizar datos"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/60 rounded-xl text-body-md text-on-surface placeholder:text-on-surface-variant/75 focus:outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-2 gap-sm">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Grado / Sección</span>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-semibold focus:outline-none"
                >
                  <option value="all">Todos ({sections.length})</option>
                  {sections.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Rendimiento</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-semibold focus:outline-none"
                >
                  <option value="all">Cualquiera</option>
                  <option value="Excelente">Excelente (⭐ &gt;= 8.5)</option>
                  <option value="Aprobado">Aprobado (👍 &gt;= 5.0)</option>
                  <option value="En riesgo">En riesgo (⚠️ &lt; 5.0)</option>
                  <option value="Sin actividad">Sin actividad</option>
                </select>
              </div>
            </div>

            {/* Sorting Row */}
            <div className="flex gap-md items-center justify-between pt-1 text-label-sm border-t border-outline-variant/10">
              <span className="text-on-surface-variant font-medium">Ordenar por:</span>
              <div className="flex gap-sm">
                <button 
                  onClick={() => setSortBy("name")} 
                  className={`px-2 py-1 rounded font-bold transition-colors ${sortBy === 'name' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  Nombre
                </button>
                <button 
                  onClick={() => setSortBy("score")} 
                  className={`px-2 py-1 rounded font-bold transition-colors ${sortBy === 'score' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  Calificación
                </button>
                <button 
                  onClick={() => setSortBy("progress")} 
                  className={`px-2 py-1 rounded font-bold transition-colors ${sortBy === 'progress' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  Progreso
                </button>
              </div>
            </div>

          </div>

          {/* Student List */}
          <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden max-h-[35rem] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-xl text-center">
                <User size={36} className="mx-auto text-on-surface-variant/40 mb-3" />
                <p className="text-body-md font-medium text-on-surface-variant">No se encontraron estudiantes.</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/20">
                {filteredStudents.map(student => {
                  const isSelected = selectedStudent?.id === student.id;
                  const progressPercentage = student.stats.totalTasks > 0 
                    ? Math.round((student.stats.completedTasks / student.stats.totalTasks) * 100) 
                    : 0;

                  return (
                    <div 
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className={`p-md hover:bg-surface-container-low transition-colors cursor-pointer flex items-center justify-between gap-md relative border-l-4 ${isSelected ? 'bg-surface-container border-primary' : 'border-transparent'}`}
                    >
                      <div className="flex items-center gap-md min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                          {student.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-label-md font-bold text-on-surface truncate">{student.full_name}</h4>
                          <p className="text-label-sm text-on-surface-variant truncate">{student.email}</p>
                          <div className="flex gap-2 items-center mt-1">
                            {student.courseSection && (
                              <span className="text-[10px] font-bold bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">
                                {student.courseSection}
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-on-surface-variant">
                              {student.stats.completedTasks} / {student.stats.totalTasks} tareas
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Score Badge & Progress indicator */}
                      <div className="flex flex-col items-end shrink-0 gap-sm">
                        {student.stats.completedTasks > 0 ? (
                          <span className={`inline-flex items-center gap-0.5 font-bold text-label-md px-2 py-0.5 rounded-full ${
                            student.stats.averageScore >= 8.5 
                              ? 'bg-secondary-container/20 text-secondary' 
                              : student.stats.averageScore >= 5.0 
                              ? 'bg-primary-container/20 text-primary' 
                              : 'bg-error/10 text-error'
                          }`}>
                            <Star size={12} fill="currentColor" /> {student.stats.averageScore}
                          </span>
                        ) : (
                          <span className="text-label-sm font-semibold text-on-surface-variant/40">Sin notas</span>
                        )}
                        <div className="w-14 bg-surface-container-high rounded-full h-1 overflow-hidden">
                          <div 
                            className="bg-primary h-full rounded-full" 
                            style={{ width: `${progressPercentage}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Student details dashboard (7 cols on lg) */}
        <div className="lg:col-span-7">
          {!selectedStudent ? (
            <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/30 p-xl flex flex-col items-center justify-center text-center min-h-[30rem] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
              <BookOpen size={64} className="text-primary/20 mb-lg" />
              <h3 className="text-headline-md font-bold text-on-surface mb-xs">Consola de Seguimiento</h3>
              <p className="text-body-md text-on-surface-variant max-w-[22rem]">
                Selecciona un estudiante de la lista de la izquierda para analizar su progreso académico, ver tareas y calificar actividades.
              </p>
            </div>
          ) : (
            <div className="space-y-lg">
              
              {/* Detailed Student Header Card */}
              <div className="bg-surface rounded-xl shadow-sm p-lg flex flex-col sm:flex-row items-center sm:items-start gap-lg relative overflow-hidden border border-outline-variant/30">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
                <div className="w-20 h-20 rounded-full bg-primary text-on-primary text-display-sm font-extrabold flex items-center justify-center shadow-sm border border-surface">
                  {selectedStudent.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-center sm:text-left z-10">
                  <h3 className="text-headline-md font-bold text-on-surface">{selectedStudent.full_name}</h3>
                  <p className="text-body-md text-on-surface-variant font-medium mt-0.5">
                    {selectedStudent.courseSection ? `${selectedStudent.courseSection} - Educación Secundaria` : 'Sección no asignada'}
                  </p>
                  <p className="text-label-sm text-on-surface-variant/80 mt-1">{selectedStudent.email}</p>
                  
                  {/* Courses enrolled list in header */}
                  <div className="mt-md flex flex-wrap gap-sm justify-center sm:justify-start">
                    {selectedStudent.courses.length === 0 ? (
                      <span className="text-[11px] font-bold text-error bg-error/10 px-2 py-0.5 rounded">
                        No matriculado en asignaturas
                      </span>
                    ) : (
                      selectedStudent.courses.map(c => (
                        <span key={c.id} className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                          {c.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="z-10 flex flex-col gap-sm w-full sm:w-auto mt-2 sm:mt-0 shrink-0">
                  <button 
                    onClick={() => handleGenerateTestData(selectedStudent)}
                    className="border border-outline hover:bg-surface-container text-on-surface font-bold text-label-sm px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} /> Generar Datos Ficticios
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-surface rounded-xl border border-outline-variant/30">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent"></div>
                  <p className="text-on-surface-variant font-medium text-body-sm">Cargando actividades del estudiante...</p>
                </div>
              ) : (
                <>
                  {/* KPIs Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                    
                    {/* KPI Tareas */}
                    <div className="bg-surface rounded-xl shadow-sm p-md flex items-center gap-md border border-outline-variant/30 hover:shadow-md transition-shadow">
                      <div className="p-3 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                        <FileText size={24} />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Tareas Entregadas</span>
                        <div className="flex items-baseline gap-xs mt-0.5">
                          <span className="text-title-xl font-bold text-on-surface">{selectedStudent.stats.completedTasks}</span>
                          <span className="text-label-sm text-on-surface-variant">/ {selectedStudent.stats.totalTasks}</span>
                        </div>
                      </div>
                    </div>

                    {/* KPI Promedio */}
                    <div className="bg-surface rounded-xl shadow-sm p-md flex items-center gap-md border border-outline-variant/30 hover:shadow-md transition-shadow">
                      <div className="p-3 bg-secondary-container/20 rounded-xl flex items-center justify-center text-secondary shrink-0">
                        <Trophy size={24} />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Promedio General</span>
                        <div className="flex items-baseline gap-xs mt-0.5">
                          <span className="text-title-xl font-bold text-on-surface">
                            {selectedStudent.stats.completedTasks > 0 ? selectedStudent.stats.averageScore : "-"}
                          </span>
                          <span className="text-label-sm text-on-surface-variant">/ 10</span>
                        </div>
                      </div>
                    </div>

                    {/* KPI Pendientes */}
                    <div className="bg-surface rounded-xl shadow-sm p-md flex items-center gap-md border border-outline-variant/30 hover:shadow-md transition-shadow">
                      <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedStudent.stats.pendingReviews > 0 
                          ? 'bg-amber-100 text-amber-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {selectedStudent.stats.pendingReviews > 0 ? <Clock size={24} /> : <CheckCircle2 size={24} />}
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Por Calificar</span>
                        <div className="flex items-baseline gap-xs mt-0.5">
                          <span className="text-title-xl font-bold text-on-surface">{selectedStudent.stats.pendingReviews}</span>
                          <span className="text-label-sm text-on-surface-variant">pendientes</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Tasks and Submissions Table */}
                  <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
                    <div className="p-lg border-b border-outline-variant/50 flex justify-between items-center bg-surface-container-low">
                      <h4 className="text-title-md font-bold text-on-surface">Tareas & Calificaciones</h4>
                      <span className="text-label-sm font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
                        {studentTasks.length} Tareas Totales
                      </span>
                    </div>

                    {studentTasks.length === 0 ? (
                      <div className="p-xl text-center">
                        <FileText size={48} className="mx-auto text-on-surface-variant/30 mb-lg" />
                        <h5 className="font-bold text-on-surface mb-xs">Sin tareas asignadas</h5>
                        <p className="text-body-md text-on-surface-variant max-w-[20rem] mx-auto">
                          Este estudiante no tiene tareas programadas porque su sección no cuenta con asignaturas o tareas creadas.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-container-low border-b border-outline-variant/40">
                              <th className="px-lg py-md text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Actividad</th>
                              <th className="px-lg py-md text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Materia</th>
                              <th className="px-lg py-md text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Fecha Límite</th>
                              <th className="px-lg py-md text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Nota</th>
                              <th className="px-lg py-md text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Estado</th>
                              <th className="px-lg py-md text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/15">
                            {studentTasks.map((t, idx) => {
                              // Color code status badges
                              let statusClass = "bg-surface-container-high text-on-surface-variant";
                              let statusLabel = "No entregado";
                              
                              if (t.status === "reviewed") {
                                statusClass = "bg-secondary-container/20 text-secondary";
                                statusLabel = "Revisado";
                              } else if (t.status === "pending") {
                                statusClass = "bg-amber-100 text-amber-700";
                                statusLabel = "Por revisar";
                              }

                              return (
                                <tr key={t.id} className="hover:bg-surface-container-lowest transition-colors">
                                  <td className="px-lg py-md">
                                    <div className="font-bold text-on-surface">{t.title}</div>
                                    <span className="text-[10px] font-bold bg-secondary-container/30 text-on-secondary-container px-2 py-0.5 rounded uppercase">
                                      {t.task_type === 'homework' ? 'Tarea' : t.task_type === 'forum' ? 'Foro' : t.task_type === 'exam' ? 'Examen' : t.task_type}
                                    </span>
                                    {t.feedback && (
                                      <p className="text-label-sm text-on-surface-variant italic mt-1 max-w-[15rem] truncate" title={t.feedback}>
                                        &ldquo;{t.feedback}&rdquo;
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-lg py-md text-on-surface-variant font-medium">
                                    {t.courseName}
                                  </td>
                                  <td className="px-lg py-md text-on-surface-variant text-label-md font-medium whitespace-nowrap">
                                    {t.due_date ? new Date(t.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : 'Sin límite'}
                                  </td>
                                  <td className="px-lg py-md text-right font-extrabold text-on-surface">
                                    {t.score !== null ? t.score.toFixed(1) : "-"}
                                  </td>
                                  <td className="px-lg py-md text-center">
                                    <span className={`inline-block px-3 py-1 rounded-full text-label-sm font-bold ${statusClass}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-lg py-md text-center">
                                    <button 
                                      onClick={() => handleOpenGrading(t)}
                                      className="p-2 hover:bg-surface-container-high rounded-full text-primary hover:text-primary-container transition-colors inline-flex items-center gap-1 font-bold text-label-sm"
                                      title={t.score !== null ? "Editar Calificación" : "Calificar"}
                                    >
                                      <Edit3 size={16} />
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
