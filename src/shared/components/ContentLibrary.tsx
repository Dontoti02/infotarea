"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Filter, Upload, BookOpen, FileText, Link as LinkIcon, 
  Video, MoreVertical, Download, Folder, PlayCircle, Table as TableIcon,
  Grid, List, X, AlertCircle, Loader2, CheckCircle2, UploadCloud
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";

function GlobalUploadResourceModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    async function loadCourses() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      
      let query = supabase.from("courses").select("id, name, section");
      
      // Si no es admin, solo mostrar sus cursos
      if (profile?.role !== 'admin') {
        query = query.eq("teacher_id", user.id);
      }
      
      const { data } = await query;
      if (data) {
        setCourses(data);
        if (data.length > 0) setSelectedCourseId(data[0].id);
      }
    }
    loadCourses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim() || !selectedCourseId) return;
    setLoading(true);
    setError(null);
    
    const course = courses.find(c => c.id === selectedCourseId);
    if (!course) return;

    // Sanitize folder name: Curso-Seccion
    const folderName = `${course.name}-${course.section}`.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
    const fileExt = file.name.split('.').pop();
    const safeFileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${folderName}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('contenidos')
      .upload(filePath, file);

    if (uploadError) {
      setError("Error al subir archivo: " + uploadError.message);
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('contenidos')
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from('resources').insert({
      course_id: course.id,
      name: name.trim(),
      file_type: fileExt?.toUpperCase() || 'FILE',
      file_url: publicUrl,
      file_size: file.size
    });

    if (insertError) {
      setError("Error al guardar en base de datos: " + insertError.message);
      setLoading(false);
      return;
    }

    onSuccess();
    onClose();
  };

  if (!mounted) return null;

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
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
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
                  {file ? file.name : "PDF, Word, Excel, PPT, etc."}
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

export function ContentLibrary() {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const supabase = createClient();

  const fetchResources = async () => {
    setLoading(true);
    // Fetch resources with their course data
    const { data, error } = await supabase
      .from('resources')
      .select('*, courses(name, section)')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setResources(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const pdfCount = resources.filter(r => r.file_type?.toUpperCase() === 'PDF').length;
  const docCount = resources.filter(r => ['DOC', 'DOCX', 'PPT', 'PPTX', 'TXT', 'XLS', 'XLSX'].includes(r.file_type?.toUpperCase())).length;
  const otherCount = resources.length - (pdfCount + docCount);

  const categories = [
    { title: "Guías de Estudio", count: `${docCount} ${docCount === 1 ? 'Documento' : 'Documentos'}`, icon: <BookOpen />, color: "bg-surface-container-low text-primary", type: 'doc' },
    { title: "PDFs", count: `${pdfCount} ${pdfCount === 1 ? 'Archivo' : 'Archivos'}`, icon: <FileText />, color: "bg-error-container text-error", type: 'pdf' },
    { title: "Otros Recursos", count: `${otherCount} ${otherCount === 1 ? 'Recurso' : 'Recursos'}`, icon: <LinkIcon />, color: "bg-tertiary-container text-on-tertiary", type: 'other' },
  ];

  const handleCategoryClick = (categoryType: string) => {
    setSelectedCategory(prev => prev === categoryType ? null : categoryType);
  };

  const getFileIcon = (fileType: string, size = 32) => {
    const type = fileType?.toLowerCase();
    if (type === 'pdf') return <FileText className="text-error" size={size} />;
    if (['xlsx', 'xls', 'csv'].includes(type)) return <TableIcon className="text-secondary" size={size} />;
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(type)) return <PlayCircle className="text-tertiary" size={size} />;
    return <Folder className="text-primary" size={size} />;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredResources = resources.filter(file => {
    // Category filter
    if (selectedCategory) {
      const type = file.file_type?.toUpperCase() || '';
      if (selectedCategory === 'pdf' && type !== 'PDF') return false;
      if (selectedCategory === 'doc' && !['DOC', 'DOCX', 'PPT', 'PPTX', 'TXT', 'XLS', 'XLSX'].includes(type)) return false;
      if (selectedCategory === 'other' && (type === 'PDF' || ['DOC', 'DOCX', 'PPT', 'PPTX', 'TXT', 'XLS', 'XLSX'].includes(type))) return false;
    }
    // Search query filter
    if (searchQuery.trim()) {
      return file.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-lg">
      {showModal && <GlobalUploadResourceModal onClose={() => setShowModal(false)} onSuccess={fetchResources} />}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h2 className="text-headline-md font-bold text-on-surface">Biblioteca de Materiales</h2>
          <p className="text-body-md font-medium text-on-surface-variant mt-1">Explora, organiza y descarga recursos académicos.</p>
        </div>
        <div className="flex items-center gap-sm">
          {selectedCategory && (
            <button 
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-xs px-md py-2 bg-surface-container border border-outline-variant rounded-lg text-primary hover:bg-surface-container-high transition-colors font-bold text-label-md"
            >
              <Filter size={18} /> Mostrar Todos
            </button>
          )}
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-xs px-md py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-container transition-colors shadow-sm font-bold text-label-md"
          >
            <Upload size={18} /> Subir Material
          </button>
        </div>
      </div>

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
                placeholder="Buscar archivos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface placeholder-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
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
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-10">
            <Folder size={40} className="mx-auto text-outline-variant mb-4" />
            <p className="text-body-lg font-medium text-on-surface-variant">No se encontraron materiales en esta vista.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md">
            {filteredResources.map((file) => (
              <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="block border border-outline-variant rounded-lg p-md hover:bg-surface-container-low hover:border-primary transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-sm">
                  {getFileIcon(file.file_type)}
                  <button className="text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                    <Download size={20} />
                  </button>
                </div>
                <h4 className="text-label-md font-bold text-on-surface line-clamp-2 mb-1">{file.name}</h4>
                <p className="text-label-sm font-bold text-on-surface-variant truncate">
                  {file.courses?.name} {file.courses?.section ? `(${file.courses.section})` : ""} • {formatFileSize(file.file_size)}
                </p>
                <div className="mt-sm flex justify-between items-center text-outline">
                  <span className="text-label-sm font-bold text-on-surface-variant">
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                </div>
              </a>
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
                  <tr key={file.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="py-4">
                      <a href={file.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 cursor-pointer">
                        <div className="p-2 rounded-lg bg-surface border border-outline-variant/30">
                          {getFileIcon(file.file_type, 24)}
                        </div>
                        <div>
                          <span className="text-label-md font-bold text-on-surface hover:text-primary hover:underline transition-colors block line-clamp-1">{file.name}</span>
                        </div>
                      </a>
                    </td>
                    <td className="py-4 text-body-md text-on-surface-variant font-medium">
                      {file.courses?.name} {file.courses?.section ? `(${file.courses.section})` : ""}
                    </td>
                    <td className="py-4 text-body-md text-on-surface-variant font-medium">
                      {formatFileSize(file.file_size)}
                    </td>
                    <td className="py-4 text-body-md text-on-surface-variant">
                      {new Date(file.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right">
                      <a 
                        href={file.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all"
                        title="Descargar / Ver"
                      >
                        <Download size={18} />
                      </a>
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
