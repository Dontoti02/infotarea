"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Filter, Upload, BookOpen, FileText, Link as LinkIcon,
  Download, ExternalLink, Folder, PlayCircle, Table as TableIcon,
  Grid, List, X, AlertCircle, Loader2, CheckCircle2, UploadCloud, Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import { translateErrorMessage } from "@/shared/utils/error-translator";
import { CONTENT_BUCKET, storageDownloadUrl, storagePathFromPublicUrl } from "@/shared/utils/storage";

/* ─────────────────────────────────────────────────────────────
 * Tipos y utilidades de presentación
 * ───────────────────────────────────────────────────────────── */

interface CourseOption {
  id: string;
  name: string;
  section: string | null;
}

interface LibraryResource {
  id: string;
  name: string;
  file_type: string | null;
  file_url: string;
  file_size: number | null;
  created_at: string;
  courses: { name: string; section: string | null } | null;
}

const DOC_TYPES = ["DOC", "DOCX", "PPT", "PPTX", "TXT", "XLS", "XLSX"];

function courseLabel(course: { name: string; section: string | null } | null | undefined): string {
  if (!course?.name) return "Sin curso";
  return course.section ? `${course.name} (${course.section})` : course.name;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function getFileIcon(fileType: string | null, size = 32) {
  const type = fileType?.toLowerCase();
  if (type === "pdf") return <FileText className="text-error" size={size} />;
  if (["xlsx", "xls", "csv"].includes(type || "")) return <TableIcon className="text-secondary" size={size} />;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(type || "")) return <PlayCircle className="text-tertiary" size={size} />;
  return <Folder className="text-primary" size={size} />;
}

/* ─────────────────────────────────────────────────────────────
 * Modal para subir un material
 * ───────────────────────────────────────────────────────────── */

function GlobalUploadResourceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;
    async function loadCourses() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

      let query = supabase.from("courses").select("id, name, section");
      // Si no es admin, solo mostrar sus cursos
      if (profile?.role !== "admin") {
        query = query.eq("teacher_id", user.id);
      }

      const { data } = await query.order("name", { ascending: true });
      if (active && data) {
        setCourses(data as CourseOption[]);
        if (data.length > 0) setSelectedCourseId(data[0].id);
      }
    }
    loadCourses().catch(() => {});
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim() || !selectedCourseId) return;
    setLoading(true);
    setError(null);

    const course = courses.find(c => c.id === selectedCourseId);
    if (!course) {
      setLoading(false);
      return;
    }

    // Sanitize folder name: Curso-Seccion
    const folderName = `${course.name}-${course.section}`.replace(/[^a-zA-Z0-9-]/g, "_").toLowerCase();
    const fileExt = file.name.split(".").pop();
    const safeFileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${folderName}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(CONTENT_BUCKET)
      .upload(filePath, file);

    if (uploadError) {
      setError("No se pudo subir el archivo: " + translateErrorMessage(uploadError));
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(CONTENT_BUCKET)
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("resources").insert({
      course_id: course.id,
      name: name.trim(),
      file_type: fileExt?.toUpperCase() || "FILE",
      file_url: publicUrl,
      file_size: file.size,
    });

    if (insertError) {
      setError("No se pudo guardar el material: " + translateErrorMessage(insertError));
      setLoading(false);
      return;
    }

    onSuccess();
    onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[32rem] relative overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-secondary via-secondary-container to-primary" />

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">Subir Material a la Biblioteca</h3>
              <p className="text-label-sm text-on-surface-variant">Añadir recurso y asignarlo a un curso</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Asignar al Curso (Grado/Sección)</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-secondary outline-none transition-all"
            >
              {courses.length === 0 ? (
                <option value="" disabled>No tienes cursos disponibles</option>
              ) : (
                courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Título del Material</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Diapositivas Clase 1"
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-secondary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Archivo a subir</label>
            <div className="border-2 border-dashed border-outline-variant/50 rounded-xl p-6 text-center hover:bg-surface-container/50 transition-colors">
              <input
                type="file"
                id="global-file-upload"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <label htmlFor="global-file-upload" className="cursor-pointer flex flex-col items-center">
                <UploadCloud size={32} className="text-secondary mb-2" />
                <span className="text-label-md font-bold text-secondary mb-1">Haz clic para seleccionar</span>
                <span className="text-label-sm text-on-surface-variant">
                  {file ? `${file.name} (${formatFileSize(file.size)})` : "PDF, Word, Excel, PPT, etc."}
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !file || !name.trim() || !selectedCourseId} className="flex-1 py-3 rounded-xl bg-secondary text-on-secondary font-bold text-label-md hover:bg-secondary-container hover:text-on-secondary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {loading ? "Subiendo..." : "Subir Archivo"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────
 * Modal de confirmación para eliminar un material
 * ───────────────────────────────────────────────────────────── */

function DeleteResourceModal({
  resource,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  resource: LibraryResource;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[28rem] relative overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-error via-error/70 to-error/30" />

        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center text-error shrink-0">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">Eliminar material</h3>
              <p className="text-body-md text-on-surface-variant mt-1">
                ¿Seguro que deseas eliminar «{resource.name}» de {courseLabel(resource.courses)}? Se
                borrará el archivo de la biblioteca y su registro. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl bg-error text-on-error font-bold text-label-md hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────
 * Biblioteca de Materiales
 * ───────────────────────────────────────────────────────────── */

export function ContentLibrary() {
  const supabase = useMemo(() => createClient(), []);

  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [role, setRole] = useState<string>("student");
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = role === "admin" || role === "teacher";

  const fetchResources = useCallback(async (): Promise<LibraryResource[]> => {
    const { data, error } = await supabase
      .from("resources")
      .select("id, name, file_type, file_url, file_size, created_at, courses(name, section)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    // El embed `courses` llega como objeto (relación muchos-a-uno) aunque el
    // cliente sin tipos generados lo infiera como arreglo.
    return (data || []) as unknown as LibraryResource[];
  }, [supabase]);

  useEffect(() => {
    let active = true;

    fetchResources()
      .then(data => {
        if (!active) return;
        setResources(data);
        setLoadError(null);
      })
      .catch((loadError: unknown) => {
        if (active) setLoadError(translateErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!active || !user) return;
        return supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (active && data?.role) setRole(data.role);
          });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [fetchResources, supabase]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchResources()
      .then(data => {
        setResources(data);
        setLoadError(null);
      })
      .catch((loadError: unknown) => setLoadError(translateErrorMessage(loadError)))
      .finally(() => setLoading(false));
  }, [fetchResources]);

  const handleUploadSuccess = useCallback(() => {
    refresh();
    setNotice("El material se subió correctamente a la biblioteca.");
  }, [refresh]);

  const openDelete = useCallback((resource: LibraryResource) => {
    setDeleteError(null);
    setPendingDelete(resource);
  }, []);

  const closeDelete = useCallback(() => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);

    // 1) Borra el registro (la RLS solo lo permite a dirección y docentes).
    const { data: deletedRows, error } = await supabase
      .from("resources")
      .delete()
      .eq("id", pendingDelete.id)
      .select("id");

    if (error) {
      setDeleteError(translateErrorMessage(error));
      setDeleting(false);
      return;
    }
    if (!deletedRows || deletedRows.length === 0) {
      setDeleteError("No tienes permisos para eliminar este material o ya no existe.");
      setDeleting(false);
      return;
    }

    // 2) Borra el archivo del almacenamiento (si la URL pertenece al bucket).
    const storagePath = storagePathFromPublicUrl(pendingDelete.file_url);
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from(CONTENT_BUCKET).remove([storagePath]);
      if (storageError) {
        console.warn("El registro se eliminó, pero el archivo no pudo borrarse del almacenamiento:", storageError.message);
      }
    }

    setResources(prev => prev.filter(item => item.id !== pendingDelete.id));
    setNotice(`«${pendingDelete.name}» se eliminó de la biblioteca.`);
    setPendingDelete(null);
    setDeleting(false);
  }, [pendingDelete, supabase]);

  const docCount = resources.filter(r => DOC_TYPES.includes(r.file_type?.toUpperCase() || "")).length;
  const pdfCount = resources.filter(r => r.file_type?.toUpperCase() === "PDF").length;
  const otherCount = resources.length - (pdfCount + docCount);

  const categories = [
    { title: "Guías de Estudio", count: `${docCount} ${docCount === 1 ? "Documento" : "Documentos"}`, icon: <BookOpen />, color: "bg-surface-container-low text-primary", type: "doc" },
    { title: "PDFs", count: `${pdfCount} ${pdfCount === 1 ? "Archivo" : "Archivos"}`, icon: <FileText />, color: "bg-error-container text-error", type: "pdf" },
    { title: "Otros Recursos", count: `${otherCount} ${otherCount === 1 ? "Recurso" : "Recursos"}`, icon: <LinkIcon />, color: "bg-tertiary-container text-on-tertiary", type: "other" },
  ];

  const handleCategoryClick = (categoryType: string) => {
    setSelectedCategory(prev => prev === categoryType ? null : categoryType);
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSearchQuery("");
  };

  const filteredResources = resources.filter(file => {
    // Filtro por categoría
    if (selectedCategory) {
      const type = file.file_type?.toUpperCase() || "";
      if (selectedCategory === "pdf" && type !== "PDF") return false;
      if (selectedCategory === "doc" && !DOC_TYPES.includes(type)) return false;
      if (selectedCategory === "other" && (type === "PDF" || DOC_TYPES.includes(type))) return false;
    }
    // Búsqueda por título o curso
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        file.name.toLowerCase().includes(q) ||
        (file.courses?.name || "").toLowerCase().includes(q) ||
        (file.courses?.section || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-lg">
      {showModal && (
        <GlobalUploadResourceModal onClose={() => setShowModal(false)} onSuccess={handleUploadSuccess} />
      )}
      {pendingDelete && (
        <DeleteResourceModal
          resource={pendingDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={closeDelete}
          onConfirm={confirmDelete}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-headline-md font-bold text-on-surface">Biblioteca de Materiales</h2>
            <span className="text-label-md font-bold px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant">
              {resources.length} {resources.length === 1 ? "material" : "materiales"}
            </span>
          </div>
          <p className="text-body-md font-medium text-on-surface-variant mt-1">
            Explora, organiza y descarga recursos académicos.
          </p>
        </div>
        <div className="flex items-center gap-sm">
          {selectedCategory && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-xs px-md py-2 bg-surface-container border border-outline-variant rounded-lg text-primary hover:bg-surface-container-high transition-colors font-bold text-label-md"
            >
              <Filter size={18} /> Mostrar Todos
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-xs px-md py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-container transition-colors shadow-sm font-bold text-label-md"
            >
              <Upload size={18} /> Subir Material
            </button>
          )}
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div className="flex items-center gap-sm bg-secondary/10 border border-secondary/25 text-on-surface px-md py-2.5 rounded-xl text-label-md font-bold">
          <CheckCircle2 size={16} className="text-secondary shrink-0" />
          {notice}
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm md:gap-gutter">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.type;
          return (
            <div
              key={cat.title}
              onClick={() => handleCategoryClick(cat.type)}
              className={`p-md rounded-xl border shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 group flex flex-col justify-between ${
                isActive
                  ? "bg-surface-container border-primary ring-2 ring-primary/10"
                  : "bg-surface-container-lowest border-outline-variant hover:border-primary/50"
              }`}
            >
              <div className="flex justify-between items-start mb-md">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:bg-primary/15 group-hover:text-primary transition-colors ${
                  isActive ? "bg-primary/15 text-primary" : cat.color
                }`}>
                  {cat.icon}
                </div>
                {isActive && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="text-title-lg font-bold text-on-surface">{cat.title}</h3>
                <p className="text-body-md font-medium text-on-surface-variant mt-1">{cat.count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Section */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-sm border-b border-outline-variant pb-md mb-md">
          <h3 className="text-title-lg font-bold text-on-surface">
            {selectedCategory
              ? `Archivos de: ${categories.find(c => c.type === selectedCategory)?.title}`
              : "Archivos Recientes"}
          </h3>
          <div className="flex flex-wrap items-center gap-sm w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
              <input
                type="text"
                placeholder="Buscar por título o curso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface placeholder-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* View Mode Buttons */}
            <div className="flex gap-xs bg-surface-container p-1 rounded-lg border border-outline-variant">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                title="Vista Cuadrícula"
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                title="Vista Lista"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : loadError ? (
          <div className="bg-error/10 border border-error/20 text-error p-md rounded-xl flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-label-md">No se pudieron cargar los materiales</p>
              <p className="text-label-md mt-0.5">{loadError}</p>
              <button
                onClick={refresh}
                className="mt-sm inline-flex items-center gap-1.5 bg-error text-on-error text-label-md font-bold px-3.5 py-2 rounded-xl hover:opacity-90 transition-opacity"
              >
                <Search size={14} /> Reintentar
              </button>
            </div>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-12">
            <Folder size={40} className="mx-auto text-outline-variant mb-4" />
            {resources.length === 0 ? (
              <>
                <p className="text-body-lg font-medium text-on-surface-variant">Aún no hay materiales en la biblioteca.</p>
                {canManage && (
                  <p className="text-body-md text-on-surface-variant/80 mt-1">
                    Usa «Subir Material» para agregar el primer recurso.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-body-lg font-medium text-on-surface-variant">
                  No se encontraron materiales con los filtros actuales.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-md inline-flex items-center gap-1.5 px-md py-2 rounded-lg bg-surface-container text-primary font-bold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  <X size={16} /> Limpiar filtros
                </button>
              </>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md">
            {filteredResources.map((file) => (
              <div
                key={file.id}
                className="flex flex-col border border-outline-variant rounded-xl p-md bg-surface-container-lowest hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-sm mb-sm">
                  <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                    {getFileIcon(file.file_type, 22)}
                  </div>
                  <span className="text-label-sm font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/40 uppercase">
                    {file.file_type || "Archivo"}
                  </span>
                </div>

                <h4 className="text-label-md font-bold text-on-surface line-clamp-2 mb-1" title={file.name}>
                  {file.name}
                </h4>
                <p className="text-label-sm font-bold text-on-surface-variant truncate" title={courseLabel(file.courses)}>
                  {courseLabel(file.courses)} • {formatFileSize(file.file_size)}
                </p>
                <p className="text-label-sm font-medium text-on-surface-variant/80 mt-xs">
                  {formatDate(file.created_at)}
                </p>

                <div className="mt-md pt-sm border-t border-outline-variant/40 flex items-center gap-xs">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-label-sm font-bold text-primary hover:bg-primary/10 transition-colors"
                    title="Abrir en una pestaña nueva"
                  >
                    <ExternalLink size={15} /> Abrir
                  </a>
                  <a
                    href={storageDownloadUrl(file.file_url)}
                    download
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-label-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                    title="Descargar archivo"
                  >
                    <Download size={15} /> Descargar
                  </a>
                  {canManage && (
                    <button
                      onClick={() => openDelete(file)}
                      className="inline-flex items-center justify-center p-2 rounded-lg text-error hover:bg-error/10 transition-colors"
                      title="Eliminar material"
                      aria-label={`Eliminar ${file.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-label-md text-on-surface-variant">
                  <th className="pb-3 font-bold">Nombre</th>
                  <th className="pb-3 font-bold">Curso</th>
                  <th className="pb-3 font-bold">Tamaño</th>
                  <th className="pb-3 font-bold">Fecha de Carga</th>
                  <th className="pb-3 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filteredResources.map((file) => (
                  <tr key={file.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4">
                      <a href={file.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 cursor-pointer">
                        <div className="p-2 rounded-lg bg-surface border border-outline-variant/30">
                          {getFileIcon(file.file_type, 24)}
                        </div>
                        <span className="text-label-md font-bold text-on-surface hover:text-primary hover:underline transition-colors block line-clamp-1">
                          {file.name}
                        </span>
                      </a>
                    </td>
                    <td className="py-4 text-body-md text-on-surface-variant font-medium">
                      {courseLabel(file.courses)}
                    </td>
                    <td className="py-4 text-body-md text-on-surface-variant font-medium">
                      {formatFileSize(file.file_size)}
                    </td>
                    <td className="py-4 text-body-md text-on-surface-variant">
                      {formatDate(file.created_at)}
                    </td>
                    <td className="py-4 text-right">
                      <div className="inline-flex items-center gap-xs">
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all"
                          title="Abrir en una pestaña nueva"
                        >
                          <ExternalLink size={18} />
                        </a>
                        <a
                          href={storageDownloadUrl(file.file_url)}
                          download
                          className="inline-flex p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all"
                          title="Descargar archivo"
                        >
                          <Download size={18} />
                        </a>
                        {canManage && (
                          <button
                            onClick={() => openDelete(file)}
                            className="inline-flex p-2 rounded-lg text-error hover:bg-error/10 transition-all"
                            title="Eliminar material"
                            aria-label={`Eliminar ${file.name}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
