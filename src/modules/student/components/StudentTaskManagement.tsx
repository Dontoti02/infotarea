"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Calendar,
  Clock,
  ChevronRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  CloudUpload,
  X,
  Send,
  File,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";

// ─────────────────────────────────────────────────
function SubmitTaskModal({
  task,
  onClose,
  onSuccess,
}: {
  task: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Exam timer states
  const [started, setStarted] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Check if task is an exam and has a timer configured
    if (task.task_type === "exam" && task.duration_minutes) {
      const existingSubmission = task.submission;
      if (existingSubmission && existingSubmission.started_at) {
        // Exam was already started
        const startTime = new Date(existingSubmission.started_at).getTime();
        const durationMs = task.duration_minutes * 60 * 1000;
        const elapsedMs = Date.now() - startTime;
        const remainingMs = durationMs - elapsedMs;
        
        if (remainingMs <= 0) {
          // Time already expired!
          setStarted(true);
          setRemainingTime(0);
          setTimeExpired(true);
        } else {
          setStarted(true);
          setRemainingTime(Math.floor(remainingMs / 1000));
        }
      }
    }
  }, [task]);

  useEffect(() => {
    if (started && remainingTime !== null && remainingTime > 0) {
      timerRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            setTimeExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, remainingTime]);

  useEffect(() => {
    if (timeExpired) {
      autoSubmitExam();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeExpired]);

  const autoSubmitExam = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Auto-submit whatever the student has typed or uploaded so far
      await supabase.from("submissions").upsert({
        task_id: task.id,
        student_id: user.id,
        content: textContent.trim() || "Examen auto-entregado por límite de tiempo.",
        file_url: file ? null : undefined, // Keep existing file if uploaded
        status: "pending"
      }, { onConflict: "task_id,student_id" });

      alert("El tiempo del examen ha terminado. Tus respuestas han sido enviadas automáticamente.");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error during auto-submission:", err);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      
      const nowStr = new Date().toISOString();

      // Upsert a submission to save the started_at timestamp
      const { error: upsertErr } = await supabase
        .from("submissions")
        .upsert({
          task_id: task.id,
          student_id: user.id,
          status: "pending",
          started_at: nowStr
        }, { onConflict: "task_id,student_id" });

      if (upsertErr) throw new Error(upsertErr.message);

      // Successfully started exam
      setStarted(true);
      setRemainingTime(task.duration_minutes * 60);
    } catch (err: any) {
      setError("Error al iniciar el examen: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !textContent.trim()) {
      setError("Debes subir un archivo o escribir una respuesta en texto.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
        const filePath = `entregas/${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("docs_tareas")
          .upload(filePath, file);

        if (uploadError) throw new Error("Error al subir el archivo: " + uploadError.message);

        const { data: { publicUrl } } = supabase.storage
          .from("docs_tareas")
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = file.name;
      }

      // Upsert (insert or update) submission
      const { error: submissionError } = await supabase.from("submissions").upsert(
        {
          task_id: task.id,
          student_id: user.id,
          content: textContent.trim() || null,
          file_url: fileUrl,
          file_name: fileName,
          status: "pending",
        },
        { onConflict: "task_id,student_id" }
      );

      if (submissionError) throw new Error(submissionError.message);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al entregar la tarea");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  // Show exam startup splash screen if student hasn't started yet
  if (task.task_type === "exam" && task.duration_minutes && !started) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[32rem] relative overflow-hidden">
          <div className="h-1 w-full bg-error" />
          
          <div className="p-6 text-center space-y-md">
            <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-2 animate-pulse">
              <Clock size={32} />
            </div>
            
            <h3 className="text-headline-sm font-bold text-on-surface">Examen con Tiempo Limitado</h3>
            <p className="text-body-md text-on-surface-variant">
              Este examen es de tipo <strong>Examen</strong> y tiene un temporizador de <strong>{task.duration_minutes} minutos</strong>.
            </p>
            <div className="bg-error/5 border border-error/20 p-md rounded-xl text-error text-label-md text-left space-y-1">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle size={16} /> Advertencias importantes:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-1 font-medium">
                <li>Una vez que inicies el examen, el temporizador comenzará a correr y no se detendrá.</li>
                <li>Si cierras la ventana o recargas la página, el temporizador seguirá corriendo en segundo plano.</li>
                <li>Al acabarse el tiempo, tus respuestas se guardarán y enviarán automáticamente.</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={onClose} 
                className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors"
              >
                Volver
              </button>
              <button 
                type="button" 
                onClick={handleStartExam} 
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-error text-white font-bold text-label-md hover:bg-error-container hover:text-on-error-container transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Iniciar Examen
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Timer configuration metrics
  const totalSeconds = (task.duration_minutes || 60) * 60;
  const pct = remainingTime !== null ? (remainingTime / totalSeconds) * 100 : 100;
  
  let progressColor = "bg-primary";
  let textColor = "text-on-surface";
  let isUrgent = false;
  if (remainingTime !== null) {
    if (remainingTime < 5 * 60) {
      progressColor = "bg-error animate-pulse";
      textColor = "text-error font-bold";
      isUrgent = true;
    } else if (remainingTime < 15 * 60) {
      progressColor = "bg-amber-500";
      textColor = "text-amber-600 font-bold";
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[34rem] relative overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-primary" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">
                {task.task_type === "exam" ? "Responder Examen" : "Entregar Tarea"}
              </h3>
              <p className="text-label-sm text-on-surface-variant line-clamp-1">{task.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={task.task_type === "exam" && started && !timeExpired} // Prevent closing active exams easily to avoid accidents
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title={task.task_type === "exam" && started ? "No puedes cerrar un examen activo. Por favor, realiza la entrega." : "Cerrar"}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Countdown timer widget for exams */}
          {task.task_type === "exam" && remainingTime !== null && (
            <div className="bg-surface-container p-md rounded-xl border border-outline-variant/50 space-y-2 animate-fade-in">
              <div className="flex justify-between items-center">
                <span className="text-label-md font-bold text-on-surface-variant flex items-center gap-1">
                  <Clock size={16} /> Tiempo Restante:
                </span>
                <span className={`text-title-lg font-mono ${textColor} ${isUrgent ? "animate-pulse text-xl" : ""}`}>
                  {formatTime(remainingTime)}
                </span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${progressColor}`} 
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Task attachment from teacher */}
          {task.attachment_url && (
            <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/50 flex items-center gap-3">
              <FileText size={18} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-label-sm text-on-surface-variant">Material adjunto por el docente:</p>
                <a
                  href={task.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label-md font-bold text-primary hover:underline flex items-center gap-1 truncate"
                >
                  {task.attachment_name || "Ver archivo"}
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {/* File upload */}
          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Subir Archivo</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-between p-sm border border-primary/30 bg-primary/5 rounded-xl">
                <div className="flex items-center gap-sm">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FileText size={18} />
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-on-surface line-clamp-1">{file.name}</p>
                    <p className="text-label-sm text-on-surface-variant">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setFile(null)} className="p-1.5 rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center hover:bg-surface-container/50 hover:border-primary/50 transition-all cursor-pointer group"
              >
                <CloudUpload size={36} className="mx-auto text-on-surface-variant group-hover:text-primary transition-colors mb-2" />
                <p className="text-label-md font-bold text-on-surface mb-1">Haz clic o arrastra tu archivo aquí</p>
                <p className="text-label-sm text-on-surface-variant">PDF, DOCX, PPT, XLSX, JPG, PNG, ZIP</p>
              </div>
            )}
          </div>

          {/* Text response (optional) */}
          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">
              {task.task_type === "exam" ? "Respuestas del Examen" : "Respuesta en texto"} 
              <span className="text-on-surface-variant font-normal"> (opcional)</span>
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
              placeholder={task.task_type === "exam" ? "Escribe las respuestas de tu examen aquí..." : "Escribe tu respuesta o comentarios aquí..."}
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={task.task_type === "exam" && started && !timeExpired} // Prevent escaping active exams easily
              className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors disabled:opacity-30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (!file && !textContent.trim())}
              className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? "Enviando..." : task.task_type === "exam" ? "Entregar Examen" : "Entregar Tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────
export function StudentTaskManagement() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskIdParam = searchParams.get("task_id");

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "submitted">("all");
  const [submittingTask, setSubmittingTask] = useState<any | null>(null);

  const supabase = createClient();

  const stripHtml = (html: string) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from("course_members")
        .select("course_id")
        .eq("profile_id", user.id);

      const courseIds = memberships?.map((cm: any) => cm.course_id) || [];
      if (courseIds.length === 0) { setTasks([]); return; }

      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`*, courses (name, section)`)
        .in("course_id", courseIds)
        .order("created_at", { ascending: false });

      const { data: submissionsData } = await supabase
        .from("submissions")
        .select("task_id, status, file_url, file_name, content, started_at")
        .eq("student_id", user.id);

      const submissionMap = new Map();
      (submissionsData ?? []).forEach((s: any) => submissionMap.set(s.task_id, s));

      if (tasksData && !tasksError) {
        const mapped = tasksData.map((t: any) => {
          const sub = submissionMap.get(t.id);
          const hasSubmission = !!sub;
          const isOverdue = t.due_date && new Date(t.due_date) < new Date();

          let status = "Pendiente";
          let statusColor = "bg-amber-100 text-amber-800 border-amber-200";
          let icon = <Clock size={14} />;
          let rawStatus = "pending";

          if (hasSubmission) {
            rawStatus = "submitted";
            if (sub.status === "reviewed") {
              status = "Revisado";
              statusColor = "bg-teal-50 text-teal-800 border-teal-200";
              icon = <CheckCircle2 size={14} className="text-teal-600" />;
            } else {
              status = "Entregado";
              statusColor = "bg-primary-container/20 text-primary border-primary/20";
              icon = <CheckCircle2 size={14} className="text-primary" />;
            }
          } else if (isOverdue) {
            status = "Vencido";
            statusColor = "bg-rose-100 text-rose-800 border-rose-200";
            icon = <AlertCircle size={14} className="text-rose-600" />;
          }

          return {
            id: t.id,
            name: t.title,
            description: stripHtml(t.description),
            task_type: t.task_type,
            duration_minutes: t.duration_minutes,
            subject: `${t.courses?.name} - ${t.courses?.section}`,
            dueDate: t.due_date
              ? new Date(t.due_date).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
              : "Sin fecha límite",
            status, statusColor, icon, rawStatus,
            attachment_url: t.attachment_url,
            attachment_name: t.attachment_name,
            submission: sub || null
          };
        });
        setTasks(mapped);
      }
    } catch (err) {
      console.error("Error loading tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  useEffect(() => {
    if (!loading && tasks.length > 0 && taskIdParam) {
      const foundTask = tasks.find(t => t.id === taskIdParam);
      if (foundTask && foundTask.rawStatus !== "submitted") {
        setSubmittingTask(foundTask);
        // Clear task_id parameter from URL without page reload
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete("task_id");
        const queryStr = newParams.toString();
        router.replace(`${window.location.pathname}${queryStr ? `?${queryStr}` : ""}`);
      }
    }
  }, [tasks, loading, taskIdParam, router]);

  const filteredTasks = tasks.filter(t => {
    if (filterMode === "pending" && t.rawStatus !== "pending") return false;
    if (filterMode === "submitted" && t.rawStatus !== "submitted") return false;
    if (searchQuery.trim()) {
      return t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-lg">
      {submittingTask && (
        <SubmitTaskModal
          task={submittingTask}
          onClose={() => setSubmittingTask(null)}
          onSuccess={loadTasks}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
        <div>
          <h2 className="text-headline-md font-bold text-on-surface">Mis Tareas</h2>
          <p className="text-body-md font-medium text-on-surface-variant">Consulta tus actividades pendientes y entregadas.</p>
        </div>
        <div className="flex items-center gap-sm bg-surface-container-lowest p-1 rounded-lg border border-outline-variant">
          {(["all", "pending", "submitted"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-1.5 rounded-md font-bold text-label-md transition-all ${
                filterMode === mode ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {mode === "all" ? "Todas" : mode === "pending" ? "Pendientes" : "Entregadas"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-md items-start lg:items-center bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="Buscar tarea o asignatura..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 text-center">
          <FolderOpen size={48} className="mx-auto text-outline-variant mb-4" />
          <p className="text-body-lg font-bold text-on-surface-variant">No tienes tareas para mostrar</p>
          <p className="text-body-md text-on-surface-variant mt-1">¡Buen trabajo, estás al día con todas tus actividades!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {filteredTasks.map((task) => (
            <div key={task.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-lg shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-start mb-md">
                  <span className={`inline-flex items-center gap-xs px-2.5 py-1 rounded-md font-bold text-[11px] border uppercase tracking-wider ${task.statusColor}`}>
                    {task.icon} {task.status}
                  </span>
                  <span className="text-label-sm font-bold text-on-surface-variant text-right max-w-[130px] line-clamp-1">{task.subject}</span>
                </div>

                <h3 className="text-title-lg font-bold text-on-surface mb-sm group-hover:text-primary transition-colors line-clamp-2">
                  {task.name}
                </h3>

                {task.description && (
                  <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-sm">{task.description}</p>
                )}

                {/* Attachment from teacher */}
                {task.attachment_url && (
                  <a
                    href={task.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-label-sm font-bold text-primary hover:underline mb-sm"
                  >
                    <FileText size={14} /> {task.attachment_name || "Ver archivo adjunto"}
                    <ExternalLink size={12} />
                  </a>
                )}

                {/* Student's submitted file */}
                {task.submission?.file_url && (
                  <a
                    href={task.submission.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-label-sm font-bold text-secondary hover:underline mb-sm"
                  >
                    <CheckCircle2 size={14} /> {task.submission.file_name || "Tu entrega"}
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="mt-lg pt-lg border-t border-outline-variant/30">
                <div className="flex items-center justify-between mb-lg">
                  <div className="flex items-center gap-xs text-on-surface-variant font-bold text-label-sm">
                    <Calendar size={14} />
                    <span>Vence: {task.dueDate}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (task.rawStatus !== "submitted") {
                      setSubmittingTask(task);
                    }
                  }}
                  className={`w-full py-2.5 rounded-lg font-bold text-label-md transition-all flex items-center justify-center gap-sm ${
                    task.rawStatus === "submitted"
                      ? "border border-outline text-on-surface-variant cursor-default"
                      : "bg-primary text-on-primary hover:bg-primary-container shadow-sm"
                  }`}
                >
                  {task.rawStatus === "submitted" ? (
                    <><CheckCircle2 size={16} /> Entrega Enviada</>
                  ) : task.rawStatus === "pending" ? (
                    <><Send size={16} /> Entregar Tarea <ChevronRight size={16} /></>
                  ) : (
                    <><AlertCircle size={16} /> Vencida — Entregar de todas formas</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
