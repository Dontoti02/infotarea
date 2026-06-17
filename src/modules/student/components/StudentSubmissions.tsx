"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  ChevronDown,
  Download,
  Loader2,
  ExternalLink,
  MessageSquare,
  ClipboardList,
  BookOpen
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function StudentSubmissions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const supabase = createClient();

  const loadSubmissionsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch course enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from("course_members")
        .select("course_id")
        .eq("profile_id", user.id);

      if (enrollError) throw enrollError;

      const courseIds = enrollments?.map((e: any) => e.course_id) || [];

      if (courseIds.length === 0) {
        setSubmissions([]);
        return;
      }

      // 2. Fetch tasks for these courses
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          *,
          courses (
            name,
            section
          )
        `)
        .in("course_id", courseIds)
        .order("due_date", { ascending: true });

      if (tasksError) throw tasksError;

      // 3. Fetch submissions by the user
      const { data: subsData, error: subsError } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", user.id);

      if (subsError) throw subsError;

      const submissionsMap = new Map(subsData?.map((s: any) => [s.task_id, s]) || []);

      const combined = (tasksData || []).map((task: any) => {
        const sub = submissionsMap.get(task.id);
        const hasSub = !!sub;
        const isOverdue = task.due_date && new Date(task.due_date) < new Date();

        let status = "No Entregado";
        let statusColor = "bg-surface-container-high text-on-surface-variant border-outline-variant/30";
        let icon = <Clock size={16} />;
        let dateStr = "Pendiente";
        let scoreStr = null;

        if (hasSub) {
          dateStr = new Date(sub.created_at).toLocaleString("es-ES", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          });
          if (sub.status === "reviewed") {
            status = "Revisado";
            statusColor = "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/20 dark:text-teal-300 dark:border-teal-900";
            icon = <CheckCircle2 size={16} className="text-teal-600 dark:text-teal-400" />;
            scoreStr = sub.score !== null && sub.score !== undefined ? `${sub.score}/100` : null;
          } else {
            status = "Entregado";
            statusColor = "bg-secondary-container text-on-secondary-container border-secondary/20";
            icon = <CheckCircle2 size={16} className="text-secondary" />;
          }
        } else if (isOverdue) {
          status = "Vencido";
          statusColor = "bg-error-container/20 text-error border-error/20";
          icon = <AlertCircle size={16} className="text-error" />;
        }

        return {
          id: task.id,
          taskName: task.title,
          description: task.description,
          subject: `${task.courses?.name || "Asignatura"} - ${task.courses?.section || ""}`,
          date: dateStr,
          status,
          statusColor,
          icon,
          score: scoreStr,
          dueDate: task.due_date 
            ? new Date(task.due_date).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) 
            : "Sin fecha límite",
          attachmentUrl: task.attachment_url,
          attachmentName: task.attachment_name,
          submission: sub || null,
          hasSub
        };
      });

      // Sort: unsubmitted/pending first, then submitted
      combined.sort((a: any, b: any) => {
        if (a.hasSub && !b.hasSub) return 1;
        if (!a.hasSub && b.hasSub) return -1;
        return 0;
      });

      setSubmissions(combined);
    } catch (err: any) {
      console.error("Error loading submissions:", err);
      setError(err.message || "Error al cargar las entregas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissionsData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={44} />
          <p className="text-body-md text-on-surface-variant font-bold">Cargando tus entregas y notas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 border border-error/20 text-error p-lg rounded-2xl flex items-center gap-md max-w-2xl mx-auto shadow-sm">
        <AlertCircle size={28} className="shrink-0" />
        <div>
          <h4 className="text-title-md font-bold">Error al cargar datos</h4>
          <p className="text-body-md mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-lg animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-md">
        <div>
          <h2 className="text-headline-md font-bold text-on-surface">Mis Entregas</h2>
          <p className="text-body-md font-medium text-on-surface-variant mt-1">Historial completo de tareas enviadas, calificaciones y retroalimentación.</p>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-16 text-center shadow-sm max-w-2xl mx-auto flex flex-col items-center gap-4">
          <ClipboardList size={48} className="text-outline-variant" />
          <h3 className="text-title-lg font-bold text-on-surface">Sin Tareas Registradas</h3>
          <p className="text-body-md text-on-surface-variant">
            Aún no tienes tareas asignadas en tus asignaturas actuales. Cuando tus docentes publiquen actividades, aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-md">
          {submissions.map((sub) => {
            const isExpanded = expandedId === sub.id;

            return (
              <div 
                key={sub.id} 
                className={`bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group ${
                  isExpanded ? "ring-2 ring-primary/20 border-primary/30" : ""
                }`}
              >
                {/* Header Row */}
                <div 
                  onClick={() => toggleExpand(sub.id)}
                  className="p-lg flex flex-col md:flex-row md:items-center justify-between gap-md cursor-pointer hover:bg-surface-container-low/20 transition-colors"
                >
                  <div className="flex gap-lg items-center min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      !sub.hasSub 
                        ? 'bg-surface-container-high text-on-surface-variant/70 border border-outline-variant/40' 
                        : 'bg-primary-container/20 text-primary border border-primary/10 shadow-inner'
                    }`}>
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-title-md md:text-title-lg font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                        {sub.taskName}
                      </h3>
                      <p className="text-body-md font-semibold text-on-surface-variant mt-0.5">{sub.subject}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-md md:gap-lg shrink-0">
                    <div className="flex flex-col items-start md:items-end">
                      <span className={`inline-flex items-center gap-xs px-2.5 py-1 rounded-md text-[11px] font-bold border uppercase tracking-wider ${sub.statusColor}`}>
                        {sub.icon}
                        {sub.status}
                      </span>
                      <span className="text-[11px] font-bold text-on-surface-variant mt-1.5 flex items-center gap-1">
                        <Clock size={12} />
                        {sub.hasSub ? `Enviado: ${sub.date}` : `Vence: ${sub.dueDate}`}
                      </span>
                    </div>

                    {sub.score ? (
                      <div className="text-left md:text-right border-l border-outline-variant/30 pl-md md:pl-lg">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Calificación</p>
                        <p className="text-title-lg md:text-headline-sm font-black text-primary mt-0.5">{sub.score}</p>
                      </div>
                    ) : (
                      sub.hasSub && (
                        <div className="text-left md:text-right border-l border-outline-variant/30 pl-md md:pl-lg">
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Calificación</p>
                          <p className="text-label-md font-bold text-secondary mt-1">Por revisar</p>
                        </div>
                      )
                    )}

                    <div className="hidden sm:block p-1.5 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
                      {isExpanded ? <ChevronDown size={20} className="text-primary" /> : <ChevronRight size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Area */}
                {isExpanded && (
                  <div className="px-lg pb-lg pt-4 border-t border-outline-variant/30 bg-surface-container-low/10 space-y-md animate-slide-down">
                    
                    {/* Task Description */}
                    {sub.description && (
                      <div className="space-y-1">
                        <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Descripción de la Tarea</h4>
                        <div 
                          className="text-body-md text-on-surface leading-relaxed task-description-content"
                          dangerouslySetInnerHTML={{ __html: sub.description }}
                        />
                        <style>{`
                          .task-description-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
                          .task-description-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
                          .task-description-content a  { color: var(--color-primary, #6200ee); text-decoration: underline; }
                          .task-description-content b, .task-description-content strong { font-weight: 700; }
                          .task-description-content i, .task-description-content em { font-style: italic; }
                          .task-description-content u { text-decoration: underline; }
                        `}</style>
                      </div>
                    )}

                    {/* Teacher Attachments */}
                    {sub.attachmentUrl && (
                      <div className="space-y-1.5">
                        <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Material Adjunto por Docente</h4>
                        <a
                          href={sub.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-label-md font-bold text-primary"
                        >
                          <FileText size={16} />
                          <span>{sub.attachmentName || "Descargar Guía / Material"}</span>
                          <Download size={14} className="ml-1" />
                        </a>
                      </div>
                    )}

                    {/* Student Submission Details */}
                    {sub.hasSub ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pt-md border-t border-outline-variant/20">
                        {/* Student Response File/Content */}
                        <div className="space-y-sm">
                          <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Tu Entrega</h4>
                          
                          {sub.submission.file_url ? (
                            <div className="space-y-2">
                              <a
                                href={sub.submission.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 p-2.5 rounded-xl border border-secondary/20 bg-secondary/5 hover:bg-secondary/10 transition-colors text-label-md font-bold text-secondary"
                              >
                                <FileText size={16} />
                                <span className="truncate max-w-[200px]">{sub.submission.file_name || "Tu Archivo"}</span>
                                <ExternalLink size={14} className="ml-1" />
                              </a>
                            </div>
                          ) : (
                            <p className="text-body-md text-on-surface-variant italic">No se adjuntó archivo.</p>
                          )}

                          {sub.submission.content && (
                            <div className="bg-surface p-3 rounded-xl border border-outline-variant/40">
                              <p className="text-label-sm font-bold text-on-surface-variant mb-1">Respuesta escrita:</p>
                              <p className="text-body-md text-on-surface leading-normal whitespace-pre-wrap">{sub.submission.content}</p>
                            </div>
                          )}
                        </div>

                        {/* Feedback & Grading Details */}
                        <div className="space-y-sm">
                          <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Retroalimentación del Docente</h4>
                          {sub.status === "reviewed" ? (
                            <div className="bg-teal-50/50 dark:bg-teal-950/10 p-3 rounded-xl border border-teal-200/50 dark:border-teal-900/50 space-y-2">
                              <div className="flex items-center gap-sm">
                                <MessageSquare size={16} className="text-teal-600 dark:text-teal-400" />
                                <span className="text-label-md font-bold text-teal-800 dark:text-teal-300">Comentarios de evaluación:</span>
                              </div>
                              <p className="text-body-md text-on-surface leading-normal whitespace-pre-wrap">
                                {sub.submission.feedback || "Sin comentarios adicionales. Excelente entrega."}
                              </p>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl border border-outline-variant/30 flex items-center gap-2 text-on-surface-variant text-body-md">
                              <Clock size={16} className="text-on-surface-variant opacity-70" />
                              <span>El docente aún está calificando esta actividad. Te notificaremos aquí mismo cuando termine.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-sm">
                        <div className="bg-amber-500/10 text-amber-700 dark:text-amber-300 p-4 rounded-xl border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-md">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={18} className="shrink-0" />
                            <span className="text-body-md font-bold">Esta tarea aún no ha sido entregada.</span>
                          </div>
                          <Link 
                            href="/student/tareas"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-label-md px-lg py-2 rounded-lg text-center transition-colors shadow-sm"
                          >
                            Ir a Entregar Tarea
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
