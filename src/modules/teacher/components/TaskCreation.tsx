"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  CloudUpload, 
  FileText, 
  X, 
  ChevronDown, 
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  File
} from "lucide-react";

export function TaskCreation() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskType, setTaskType] = useState<"homework" | "forum" | "exam">("homework");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingCourses, setFetchingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("course_id");

  useEffect(() => {
    async function loadCourses() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        let query = supabase.from("courses").select("id, name, section");
        if (profile?.role !== "admin") {
          query = query.eq("teacher_id", user.id);
        }

        const { data, error } = await query;
        if (data && !error) {
          setCourses(data);
          // Pre-select from query param first, otherwise default to first course
          const targetId = preselectedCourseId && data.find((c: any) => c.id === preselectedCourseId)
            ? preselectedCourseId
            : data.length > 0 ? data[0].id : "";
          setSelectedCourseId(targetId);
        }
      } catch (err) {
        console.error("Error loading courses:", err);
      } finally {
        setFetchingCourses(false);
      }
    }
    loadCourses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rich-text editor helpers ──────────────────────────────────
  const applyFormat = (command: string, value?: string) => {
    // Restore focus to the editor before executing the command
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const handleLink = () => {
    const url = prompt("Ingresa la URL del enlace:", "https://");
    if (url && url !== "https://") {
      applyFormat("createLink", url);
    }
  };

  const getEditorContent = () => editorRef.current?.innerHTML?.trim() ?? "";

  // ── File helpers ──────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAttachmentFile(file);
  };

  const handleDropZoneClick = () => fileInputRef.current?.click();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setAttachmentFile(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const description = getEditorContent();
    if (!title.trim() || !selectedCourseId) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      // Upload attachment to docs_tareas bucket if a file was selected
      if (attachmentFile) {
        const ext = attachmentFile.name.split(".").pop();
        const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
        const filePath = `tareas/${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("docs_tareas")
          .upload(filePath, attachmentFile);

        if (uploadError) {
          throw new Error("Error al subir el archivo adjunto: " + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from("docs_tareas")
          .getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentName = attachmentFile.name;
      }

      const { error: insertError } = await supabase.from("tasks").insert({
        course_id: selectedCourseId,
        title: title.trim(),
        description: description || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        task_type: taskType,
        duration_minutes: taskType === "exam" && durationMinutes ? Number(durationMinutes) : null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });

      if (insertError) throw new Error(insertError.message);

      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      setError(err.message || "Error al crear la tarea");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-gutter">
      {/* Left Column */}
      <div className="flex-1 flex flex-col gap-lg">
        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3 text-body-md animate-fade-in">
            <AlertCircle size={20} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-secondary-container/20 border border-secondary/20 text-secondary p-4 rounded-xl flex items-center gap-3 text-body-md animate-fade-in">
            <CheckCircle2 size={20} className="shrink-0" />
            <span>¡Tarea creada y asignada con éxito! Redirigiendo...</span>
          </div>
        )}

        {/* Title & Instructions */}
        <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant flex flex-col gap-md">
          <div>
            <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="task-title">
              Título de la tarea
            </label>
            <input
              id="task-title"
              className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all outline-none"
              placeholder="Ej: Ensayo sobre la Revolución Industrial"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="task-instructions">
              Instrucciones
            </label>

            {/* ── Toolbar ── */}
            <div className="border border-outline-variant border-b-0 rounded-t-lg bg-surface px-sm py-xs flex gap-xs items-center">
              <button
                type="button"
                title="Negrita (Ctrl+B)"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }}
                className="p-1.5 hover:bg-surface-container rounded font-bold text-on-surface-variant transition-colors"
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                title="Cursiva (Ctrl+I)"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }}
                className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant transition-colors"
              >
                <Italic size={16} />
              </button>
              <button
                type="button"
                title="Subrayado (Ctrl+U)"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }}
                className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant transition-colors"
              >
                <Underline size={16} />
              </button>
              <div className="w-px h-4 bg-outline-variant mx-1" />
              <button
                type="button"
                title="Lista con viñetas"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("insertUnorderedList"); }}
                className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant transition-colors"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                title="Lista numerada"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("insertOrderedList"); }}
                className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant transition-colors"
              >
                <ListOrdered size={16} />
              </button>
              <div className="w-px h-4 bg-outline-variant mx-1" />
              <button
                type="button"
                title="Insertar enlace"
                onMouseDown={(e) => { e.preventDefault(); handleLink(); }}
                className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant transition-colors"
              >
                <LinkIcon size={16} />
              </button>
            </div>

            {/* ── Editable area ── */}
            <div
              id="task-instructions"
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[200px] w-full bg-surface border border-outline-variant rounded-b-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all overflow-auto task-editor"
              data-placeholder="Escribe las instrucciones detalladas aquí..."
            />
            <style>{`
              .task-editor:empty:before {
                content: attr(data-placeholder);
                color: #9ca3af;
                pointer-events: none;
                display: block;
              }
              .task-editor ul { list-style: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
              .task-editor ol { list-style: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
              .task-editor a  { color: #6200ee; text-decoration: underline; }
              .task-editor b, .task-editor strong { font-weight: 700; }
              .task-editor i, .task-editor em { font-style: italic; }
              .task-editor u { text-decoration: underline; }
            `}</style>
          </div>
        </div>

        {/* Attachments Card */}
        <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant flex flex-col gap-md">
          <h3 className="text-title-lg font-bold text-on-surface">Archivo Adjunto de la Tarea</h3>
          <p className="text-label-md text-on-surface-variant -mt-2">El alumno podrá ver y descargar este archivo al revisar la tarea.</p>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            id="task-file-upload"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.txt"
            onChange={handleFileChange}
          />

          {attachmentFile ? (
            <div className="flex items-center justify-between p-sm border border-primary/30 bg-primary/5 rounded-xl">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-label-md font-bold text-on-surface line-clamp-1">{attachmentFile.name}</p>
                  <p className="text-label-sm text-on-surface-variant">{formatBytes(attachmentFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentFile(null)}
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div
              onClick={handleDropZoneClick}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-outline-variant rounded-xl p-lg flex flex-col items-center justify-center bg-surface-container-low text-center hover:bg-surface-container hover:border-primary/50 transition-all cursor-pointer group"
            >
              <CloudUpload size={44} className="text-on-surface-variant mb-sm group-hover:text-primary transition-colors" />
              <p className="text-body-md text-on-surface font-bold mb-xs">Haz clic o arrastra un archivo aquí</p>
              <p className="text-label-md font-medium text-on-surface-variant">PDF, DOCX, PPT, XLSX, JPG, PNG, ZIP (Max. 10MB)</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Settings */}
      <div className="w-full lg:w-[360px] flex flex-col gap-lg">
        <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant flex flex-col gap-md">
          <h3 className="text-title-lg font-bold text-on-surface border-b border-outline-variant pb-sm mb-sm">Configuración</h3>

          <div>
            <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="course-select">Curso</label>
            <div className="relative">
              <select
                id="course-select"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                required
                className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary transition-all outline-none pr-10"
              >
                {fetchingCourses ? (
                  <option disabled value="">Cargando cursos...</option>
                ) : courses.length === 0 ? (
                  <option disabled value="">No tienes cursos asignados</option>
                ) : (
                  courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                  ))
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="task-type">Tipo de Actividad</label>
            <div className="relative">
              <select
                id="task-type"
                value={taskType}
                onChange={(e) => {
                  setTaskType(e.target.value as any);
                  if (e.target.value !== "exam") {
                    setDurationMinutes("");
                  }
                }}
                className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary transition-all outline-none pr-10"
              >
                <option value="homework">Tarea</option>
                <option value="forum">Foro</option>
                <option value="exam">Examen</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" size={20} />
            </div>
          </div>

          {taskType === "exam" && (
            <div className="animate-fade-in">
              <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="duration-minutes">
                Duración del Examen (minutos)
              </label>
              <input
                id="duration-minutes"
                type="number"
                min="1"
                placeholder="Ej: 60"
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="due-date">Fecha y Hora Límite</label>
            <input
              id="due-date"
              className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all outline-none"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant flex flex-col gap-md sticky top-[88px]">
          <button
            type="submit"
            disabled={loading || fetchingCourses || courses.length === 0 || !title.trim()}
            className="w-full bg-primary hover:bg-primary-container text-on-primary font-bold text-label-md py-3 px-6 rounded-full transition-all flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {loading ? "Publicando..." : "Publicar Tarea"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full bg-transparent border border-outline hover:bg-surface-container-low text-on-surface font-bold text-label-md py-3 px-6 rounded-full transition-colors flex justify-center items-center gap-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}
