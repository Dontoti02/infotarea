"use client";

import React, { useState, useEffect } from "react";
import { 
  BookOpen, Users, Clock, ArrowLeft, Calendar, FileText, 
  FolderDown, Plus, Download, ChevronRight, LayoutGrid,
  X, AlertCircle, Loader2, CheckCircle2, UploadCloud
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

function UploadResourceModal({ 
  course, 
  onClose, 
  onSuccess 
}: { 
  course: any; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    
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
              <h3 className="text-title-lg font-bold text-on-surface">Subir Material</h3>
              <p className="text-label-sm text-on-surface-variant">Añadir recursos al curso</p>
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
                id="file-upload"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
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
            <button type="submit" disabled={loading || !file || !name.trim()} className="flex-1 py-3 rounded-xl bg-secondary text-on-secondary font-bold text-label-md hover:bg-secondary-container hover:text-on-secondary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
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

interface CourseDetailsProps {
  courseId: string;
  userRole?: "admin" | "teacher" | "student";
}

export function CourseDetails({ courseId, userRole }: CourseDetailsProps) {
  const [course, setCourse] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "resources">("overview");
  const [role, setRole] = useState<string>(userRole || "student");
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const fetchCourseData = async () => {
    setLoading(true);
    if (!userRole) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setRole(profile?.role || "student");
      }
    } else {
      setRole(userRole);
    }


    // Load Course
    const { data: cData } = await supabase
      .from("courses")
      .select(`*, course_members(count)`)
      .eq("id", courseId)
      .single();
      
    if (cData) {
      setCourse({
        ...cData,
        _count: { members: Array.isArray(cData.course_members) ? cData.course_members[0].count : (cData.course_members?.count ?? 0) }
      });
    }

    // Load Tasks
    const { data: tData } = await supabase
      .from("tasks")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    if (tData) setTasks(tData);

    // Load Resources
    const { data: rData } = await supabase
      .from("resources")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    if (rData) setResources(rData);

    setLoading(false);
  };

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        <p className="text-on-surface-variant font-medium">Cargando detalles del curso...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <BookOpen size={48} className="mx-auto text-on-surface-variant opacity-40 mb-4" />
        <h2 className="text-headline-md font-bold text-on-surface">Curso no encontrado</h2>
        <button onClick={() => router.back()} className="mt-4 text-primary font-bold hover:underline">Volver atrás</button>
      </div>
    );
  }

  const canEdit = role === "teacher" || role === "admin";

  return (
    <div className="space-y-lg animate-fade-in">
      {showUploadModal && (
        <UploadResourceModal 
          course={course} 
          onClose={() => setShowUploadModal(false)} 
          onSuccess={fetchCourseData} 
        />
      )}

      {/* Back Button */}
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors font-bold text-label-md"
      >
        <ArrowLeft size={16} /> Volver a Mis Cursos
      </button>

      {/* Hero Banner */}
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm relative h-64 md:h-80 group">
        <img 
          src={course.image_url || "https://images.unsplash.com/photo-1461360228754-6e81c478bc88?w=800"} 
          alt={course.name} 
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 p-lg md:p-xl text-white">
          <div className="flex items-center gap-sm mb-2">
            <span className="text-label-sm font-bold bg-primary px-3 py-1 rounded-full shadow-sm">{course.section}</span>
          </div>
          <h1 className="text-display-lg font-bold drop-shadow-md">{course.name}</h1>
          <div className="flex flex-wrap items-center gap-md mt-sm text-white/90">
            <div className="flex items-center gap-xs text-label-md font-medium bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md">
              <Users size={16} /> {course._count?.members || 0} Participantes
            </div>
            {course.schedule && (
              <div className="flex items-center gap-xs text-label-md font-medium bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md">
                <Clock size={16} /> {course.schedule}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-sm border-b border-outline-variant/30 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-md py-sm rounded-lg font-bold text-label-md transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
        >
          <LayoutGrid size={16} /> Vista General
        </button>
        <button 
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-md py-sm rounded-lg font-bold text-label-md transition-colors whitespace-nowrap ${activeTab === 'tasks' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
        >
          <FileText size={16} /> Tareas ({tasks.length})
        </button>
        <button 
          onClick={() => setActiveTab("resources")}
          className={`flex items-center gap-2 px-md py-sm rounded-lg font-bold text-label-md transition-colors whitespace-nowrap ${activeTab === 'resources' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
        >
          <FolderDown size={16} /> Recursos ({resources.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="mt-lg">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            <div className="lg:col-span-2 space-y-lg">
              <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/30 shadow-sm">
                <h3 className="text-title-lg font-bold text-on-surface mb-md">Próximas Entregas</h3>
                {tasks.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">No hay tareas pendientes asignadas.</p>
                ) : (
                  <div className="space-y-sm">
                    {tasks.slice(0, 3).map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => {
                          if (role === "student") {
                            router.push(`/student/tareas?task_id=${task.id}`);
                          } else if (role === "teacher") {
                            router.push(`/teacher/entregas?task_id=${task.id}`);
                          } else {
                            router.push(`/${role}/tareas`);
                          }
                        }}
                        className="flex items-center justify-between p-md bg-surface-container-low rounded-lg hover:border-primary border border-transparent transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-md">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="text-label-md font-bold text-on-surface">{task.title}</p>
                            <p className="text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                              <Calendar size={12} /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Sin fecha'}
                            </p>
                          </div>
                        </div>
                        <button className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-lg">
               <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/30 shadow-sm">
                <h3 className="text-title-lg font-bold text-on-surface mb-md">Últimos Recursos</h3>
                {resources.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">No se ha subido material.</p>
                ) : (
                  <div className="space-y-sm">
                    {resources.slice(0, 4).map(res => (
                      <a key={res.id} href={res.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-sm group cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                          <Download size={14} />
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-label-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">{res.name}</p>
                          <p className="text-label-sm text-on-surface-variant">{res.file_type || 'Documento'}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between mb-lg">
              <h3 className="text-title-lg font-bold text-on-surface">Todas las Tareas</h3>
              {canEdit && (
                <button
                  onClick={() => router.push(`/${role}/tareas/nueva?course_id=${courseId}`)}
                  className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-label-md flex items-center gap-2 hover:bg-primary-container transition-colors shadow-sm"
                >
                  <Plus size={16} /> Nueva Tarea
                </button>
              )}
            </div>
            {tasks.length === 0 ? (
              <div className="text-center py-10">
                <FileText size={40} className="mx-auto text-outline-variant mb-4" />
                <p className="text-body-lg font-medium text-on-surface-variant">No se han publicado tareas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => {
                      if (role === "student") {
                        router.push(`/student/tareas?task_id=${task.id}`);
                      } else if (role === "teacher") {
                        router.push(`/teacher/entregas?task_id=${task.id}`);
                      } else {
                        router.push(`/${role}/tareas`);
                      }
                    }}
                    className="p-md bg-surface border border-outline-variant/30 rounded-xl hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-label-sm font-bold bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                          {task.task_type === 'homework' ? 'Tarea' : task.task_type === 'forum' ? 'Foro' : task.task_type === 'exam' ? 'Examen' : task.task_type}
                        </span>
                      </div>
                      <h4 className="text-title-lg font-bold text-on-surface mb-2">{task.title}</h4>
                      <p className="text-body-md text-on-surface-variant line-clamp-2 mb-4">
                        {task.description ? task.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : "Sin descripción"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
                      <span className="text-label-sm font-bold text-on-surface-variant flex items-center gap-1">
                        <Calendar size={14} /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Sin límite'}
                      </span>
                      <span className="text-primary font-bold text-label-md hover:underline">Ver Tarea</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "resources" && (
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between mb-lg">
              <h3 className="text-title-lg font-bold text-on-surface">Material y Recursos</h3>
              {canEdit && (
                <button 
                  onClick={() => setShowUploadModal(true)}
                  className="bg-secondary text-on-secondary px-4 py-2 rounded-lg font-bold text-label-md flex items-center gap-2 hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow-sm"
                >
                  <Plus size={16} /> Subir Material
                </button>
              )}
            </div>
            {resources.length === 0 ? (
              <div className="text-center py-10">
                <FolderDown size={40} className="mx-auto text-outline-variant mb-4" />
                <p className="text-body-lg font-medium text-on-surface-variant">Aún no hay archivos de estudio.</p>
              </div>
            ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                 {resources.map(res => (
                   <a key={res.id} href={res.file_url} target="_blank" rel="noreferrer" className="flex items-start gap-4 p-md bg-surface border border-outline-variant/30 rounded-xl hover:border-primary transition-colors group">
                     <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                       <Download size={20} />
                     </div>
                     <div className="overflow-hidden">
                       <h4 className="text-label-md font-bold text-on-surface truncate mb-1 group-hover:text-primary">{res.name}</h4>
                       <p className="text-label-sm text-on-surface-variant uppercase">{res.file_type || 'FILE'}</p>
                     </div>
                   </a>
                 ))}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
