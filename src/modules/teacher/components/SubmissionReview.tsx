"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  User,
  Clock,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  File,
  ExternalLink,
  BookOpen,
  Send
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Props {
  submissionId: string;
}

export function SubmissionReview({ submissionId }: Props) {
  const [submission, setSubmission] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grading form
  const [score, setScore] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadSubmission() {
      setLoading(true);
      try {
        let res = await supabase
          .from("submissions")
          .select(`
            *,
            tasks (
              id,
              title,
              description,
              due_date,
              attachment_url,
              attachment_name,
              courses (
                name,
                section
              )
            ),
            profiles:student_id (
              id,
              full_name,
              avatar_url,
              role,
              email
            )
          `)
          .eq("id", submissionId)
          .single();

        if (res.error && res.error.message.includes("email")) {
          console.warn("profiles.email does not exist. Using fallback query without email.");
          res = await supabase
            .from("submissions")
            .select(`
              *,
              tasks (
                id,
                title,
                description,
                due_date,
                attachment_url,
                attachment_name,
                courses (
                  name,
                  section
                )
              ),
              profiles:student_id (
                id,
                full_name,
                avatar_url,
                role
              )
            `)
            .eq("id", submissionId)
            .single();
        }

        if (res.error || !res.data) {
          setError("No se encontró la entrega solicitada o no tienes permiso para revisarla.");
          return;
        }

        const data = res.data;
        setSubmission(data);
        setTask(data.tasks);
        setStudent(data.profiles);
        if (data.score !== null && data.score !== undefined) setScore(String(data.score));
        if (data.feedback) setFeedback(data.feedback);
      } catch (err: any) {
        setError(err.message || "Error al cargar la entrega");
      } finally {
        setLoading(false);
      }
    }
    loadSubmission();
  }, [submissionId]);

  const handleSaveGrade = async () => {
    if (!submission) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const numScore = score !== "" ? parseFloat(score) : null;
    if (numScore !== null && (numScore < 0 || numScore > 100)) {
      setSaveError("La calificación debe estar entre 0 y 100.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        score: numScore,
        feedback: feedback.trim() || null,
        status: "reviewed",
      })
      .eq("id", submissionId);

    if (updateError) {
      setSaveError("Error al guardar: " + updateError.message);
    } else {
      setSaveSuccess(true);
      setSubmission((prev: any) => ({ ...prev, status: "reviewed", score: numScore, feedback }));
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setSaving(false);
  };

  const handleRequestCorrection = async () => {
    if (!submission) return;
    setSaving(true);
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ status: "pending", feedback: feedback.trim() || null })
      .eq("id", submissionId);
    if (!updateError) {
      setSubmission((prev: any) => ({ ...prev, status: "pending" }));
    }
    setSaving(false);
  };

  const getFileIcon = (url: string | null) => {
    if (!url) return <File size={32} className="text-primary" />;
    const ext = url.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText size={32} className="text-error" />;
    return <File size={32} className="text-primary" />;
  };

  const isImage = (url: string | null) => {
    if (!url) return false;
    const ext = url.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
  };

  const isPDF = (url: string | null) => {
    if (!url) return false;
    return url.split(".").pop()?.toLowerCase() === "pdf";
  };

  const getInitials = (name: string) => name?.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "?";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-container-low h-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-body-md text-on-surface-variant font-medium">Cargando entrega...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-container-low h-full p-8">
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-8 text-center max-w-md shadow-sm">
          <AlertCircle size={48} className="mx-auto text-error mb-4" />
          <h3 className="text-title-lg font-bold text-on-surface mb-2">Entrega no encontrada</h3>
          <p className="text-body-md text-on-surface-variant">{error || "La entrega solicitada no existe."}</p>
          <Link href="/teacher/tareas" className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors">
            Volver a Tareas
          </Link>
        </div>
      </div>
    );
  }

  const isOnTime = task?.due_date && new Date(submission.created_at) <= new Date(task.due_date);

  return (
    <div className="flex-1 flex overflow-hidden bg-surface-container-low h-full">
      {/* Document Viewer — Left Panel */}
      <section className="flex-1 flex flex-col border-r border-outline-variant overflow-hidden">
        {/* Viewer header */}
        <div className="h-12 bg-surface border-b border-outline-variant flex items-center justify-between px-md shrink-0">
          <div className="flex items-center gap-sm">
            <BookOpen size={18} className="text-on-surface-variant" />
            <span className="text-label-md font-bold text-on-surface">{task?.title || "Tarea"}</span>
            {task?.courses && (
              <span className="text-label-sm text-on-surface-variant ml-1">· {task.courses.name} {task.courses.section}</span>
            )}
          </div>
          <div className="flex items-center gap-xs">
            {submission.file_url && (
              <a
                href={submission.file_url}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors flex items-center gap-1.5 text-label-sm font-bold"
                title="Abrir en nueva pestaña"
              >
                <ExternalLink size={16} />
                Abrir
              </a>
            )}
            {submission.file_url && (
              <a
                href={submission.file_url}
                download
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors flex items-center gap-1.5 text-label-sm font-bold"
                title="Descargar"
              >
                <Download size={16} />
                Descargar
              </a>
            )}
          </div>
        </div>

        {/* Document Canvas */}
        <div className="flex-1 overflow-auto p-lg flex flex-col gap-lg bg-surface-container-low">
          {/* Task instructions */}
          {task?.description && (
            <div className="bg-surface border border-outline-variant/50 rounded-xl p-lg max-w-3xl mx-auto w-full">
              <h4 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-sm">Instrucciones de la tarea</h4>
              <div 
                className="text-body-md text-on-surface task-description-content"
                dangerouslySetInnerHTML={{ __html: task.description }}
              />
              <style>{`
                .task-description-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
                .task-description-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
                .task-description-content a  { color: var(--color-primary, #6200ee); text-decoration: underline; }
                .task-description-content b, .task-description-content strong { font-weight: 700; }
                .task-description-content i, .task-description-content em { font-style: italic; }
                .task-description-content u { text-decoration: underline; }
              `}</style>
              {task.attachment_url && (
                <a
                  href={task.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 mt-md px-sm py-1.5 bg-surface-container rounded-lg border border-outline-variant text-label-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  <FileText size={16} className="text-primary" />
                  {task.attachment_name || "Archivo adjunto de la tarea"}
                  <ExternalLink size={14} className="text-on-surface-variant" />
                </a>
              )}
            </div>
          )}

          {/* Submission file viewer */}
          <div className="bg-surface shadow-sm border border-outline-variant rounded-xl max-w-3xl mx-auto w-full overflow-hidden">
            {submission.file_url ? (
              <>
                {isImage(submission.file_url) && (
                  <img
                    src={submission.file_url}
                    alt="Entrega del alumno"
                    className="w-full h-auto object-contain max-h-[70vh] p-lg"
                  />
                )}
                {isPDF(submission.file_url) && (
                  <iframe
                    src={`${submission.file_url}#toolbar=0`}
                    className="w-full min-h-[70vh]"
                    title="Vista previa del PDF"
                  />
                )}
                {!isImage(submission.file_url) && !isPDF(submission.file_url) && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    {getFileIcon(submission.file_url)}
                    <p className="text-body-md font-bold text-on-surface">{submission.file_name || "Archivo entregado"}</p>
                    <p className="text-label-md text-on-surface-variant">Este tipo de archivo no tiene vista previa en el navegador.</p>
                    <a
                      href={submission.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors"
                    >
                      <Download size={18} /> Descargar para ver
                    </a>
                  </div>
                )}
              </>
            ) : submission.content ? (
              <div className="p-xl min-h-[400px]">
                <h4 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-sm">Respuesta en texto</h4>
                <p className="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">{submission.content}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle size={40} className="text-outline-variant" />
                <p className="text-body-md font-bold text-on-surface-variant">El alumno no adjuntó ningún archivo ni texto.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grading Panel — Right Panel */}
      <aside className="w-[400px] bg-surface flex flex-col shrink-0 h-full overflow-y-auto border-l border-outline-variant">
        {/* Student info */}
        <div className="p-lg border-b border-outline-variant space-y-md">
          <div className="flex items-center gap-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {student?.avatar_url ? (
                <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-primary text-title-sm">{getInitials(student?.full_name || "?")}</span>
              )}
            </div>
            <div>
              <h2 className="text-title-lg font-bold text-on-surface">{student?.full_name || "Alumno"}</h2>
              <span className="text-label-sm font-medium text-on-surface-variant">{student?.email || ""}</span>
            </div>
          </div>

          {/* Status chip */}
          <div className="flex items-center justify-between">
            <span className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Estado</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold border ${
              submission.status === "reviewed"
                ? "bg-teal-50 text-teal-800 border-teal-200"
                : isOnTime
                  ? "bg-primary-container/20 text-primary border-primary/20"
                  : "bg-error-container/20 text-error border-error/20"
            }`}>
              <Clock size={14} />
              {submission.status === "reviewed"
                ? "Revisado"
                : isOnTime
                  ? "Entregado a tiempo"
                  : "Entregado tarde"}
            </span>
          </div>

          {/* Submission date */}
          <p className="text-body-md font-medium text-on-surface-variant">
            Enviado: {new Date(submission.created_at).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}
          </p>

          {/* Task due date */}
          {task?.due_date && (
            <p className="text-label-sm text-on-surface-variant">
              Fecha límite: {new Date(task.due_date).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}
            </p>
          )}
        </div>

        {/* Grading form */}
        <div className="flex-1 p-lg space-y-lg">
          {saveSuccess && (
            <div className="bg-secondary-container/20 border border-secondary/20 text-secondary p-3 rounded-xl flex items-center gap-2 text-label-md">
              <CheckCircle2 size={18} /> Revisión guardada correctamente.
            </div>
          )}
          {saveError && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
              <AlertCircle size={18} /> {saveError}
            </div>
          )}

          {/* Score */}
          <div className="space-y-sm">
            <label className="text-label-md font-bold text-on-surface uppercase tracking-wider block">Calificación</label>
            <div className="flex items-center gap-sm">
              <input
                className="w-28 px-md py-sm border border-outline-variant rounded-xl text-display-sm font-bold text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary outline-none transition-shadow"
                max="100"
                min="0"
                step="0.5"
                placeholder="--"
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
              <span className="text-title-lg font-bold text-on-surface-variant">/ 100 pts</span>
            </div>
            {score !== "" && (
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    parseFloat(score) >= 70 ? "bg-secondary" : parseFloat(score) >= 50 ? "bg-amber-500" : "bg-error"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(score)))}%` }}
                />
              </div>
            )}
          </div>

          {/* Feedback */}
          <div className="space-y-sm flex-1 flex flex-col">
            <label className="text-label-md font-bold text-on-surface uppercase tracking-wider block">
              Comentarios y Retroalimentación
            </label>
            <textarea
              className="w-full flex-1 min-h-[180px] p-md border border-outline-variant rounded-xl text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-shadow resize-none outline-none"
              placeholder="Escribe aquí la retroalimentación para el alumno. Sé específico y constructivo..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-lg border-t border-outline-variant bg-surface space-y-md shrink-0">
          <button
            onClick={handleSaveGrade}
            disabled={saving}
            className="w-full py-md px-lg bg-primary text-on-primary rounded-xl font-bold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Guardando..." : "Guardar Calificación"}
          </button>
          <button
            onClick={handleRequestCorrection}
            disabled={saving}
            className="w-full py-md px-lg border border-secondary text-secondary rounded-xl font-bold text-label-md uppercase tracking-wider hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RotateCcw size={18} />
            Solicitar Corrección
          </button>
        </div>
      </aside>
    </div>
  );
}
