"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Users, 
  Clock, 
  ChevronRight, 
  MoreVertical,
  Plus,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Edit2,
  Trash2,
  Image as ImageIcon,
  User
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  name: string;
  section: string;
  image_url: string | null;
  schedule: string | null;
  teacher_id: string | null;
  created_at: string;
  teacher?: {
    full_name: string;
  } | null;
  _count?: {
    members: number;
  }
}

interface CourseModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Course | null;
  userRole?: string;
}

function CourseModal({ onClose, onSuccess, initialData, userRole }: CourseModalProps) {
  const isEditing = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [grade, setGrade] = useState(() => {
    if (!initialData?.section) return "1";
    const m = initialData.section.match(/[1-5]/);
    return m ? m[0] : "1";
  });
  const [sectionVal, setSectionVal] = useState(() => {
    if (!initialData?.section) return "A";
    const m = initialData.section.match(/[A-G]/i);
    return m ? m[0].toUpperCase() : "A";
  });
  const [schedule, setSchedule] = useState(initialData?.schedule || "");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherId, setTeacherId] = useState(initialData?.teacher_id || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function loadTeachers() {
      const supabase = createClient();
      const { data, error: tErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .order("full_name");
      if (!tErr && data) {
        setTeachers(data);
      }
    }
    loadTeachers();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !grade || !sectionVal) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();

    let finalImageUrl = initialData?.image_url || "https://images.unsplash.com/photo-1461360228754-6e81c478bc88?w=800&auto=format&fit=crop&q=60";

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('img_cursos')
        .upload(filePath, imageFile);

      if (uploadError) {
        setError("Error al subir la imagen: " + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('img_cursos')
        .getPublicUrl(filePath);

      finalImageUrl = publicUrl;
    }

    const courseSection = `${grade}${sectionVal}`;

    // Helper: find all student IDs enrolled in any course with this section.
    // The student-to-section relationship is stored via course_members
    // (students are added to an "Aula X" course during creation/import).
    async function getStudentsBySection(section: string): Promise<string[]> {
      // 1. Find all courses that share this section
      const { data: sectionCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("section", section);

      if (!sectionCourses || sectionCourses.length === 0) return [];
      const sectionCourseIds = sectionCourses.map((c: any) => c.id);

      // 2. Get student members of those courses (deduplicated)
      const { data: members } = await supabase
        .from("course_members")
        .select("profile_id, profiles!inner(role)")
        .in("course_id", sectionCourseIds)
        .eq("profiles.role", "student");

      if (!members || members.length === 0) return [];
      return [...new Set(members.map((m: any) => m.profile_id))];
    }

    if (isEditing) {
      // Update course details
      const { error: updateError } = await supabase.from("courses")
        .update({
          name: name.trim(),
          section: courseSection,
          schedule: schedule.trim() || null,
          image_url: finalImageUrl,
          teacher_id: teacherId || null
        })
        .eq("id", initialData!.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Handle teacher course_members enrollment
      const oldTeacherId = initialData.teacher_id;
      const newTeacherId = teacherId;

      if (oldTeacherId && oldTeacherId !== newTeacherId) {
        await supabase.from("course_members")
          .delete()
          .eq("course_id", initialData.id)
          .eq("profile_id", oldTeacherId);
      }

      if (newTeacherId) {
        await supabase.from("course_members")
          .upsert({ course_id: initialData.id, profile_id: newTeacherId });
      }

      // Auto-enroll students from same section
      const studentIds = await getStudentsBySection(courseSection);
      if (studentIds.length > 0) {
        const inserts = studentIds.map((sid) => ({
          course_id: initialData!.id,
          profile_id: sid,
        }));
        await supabase.from("course_members").upsert(inserts, { ignoreDuplicates: true });
      }

    } else {
      // Create course
      const { data: newCourse, error: insertError } = await supabase.from("courses").insert({
        name: name.trim(),
        section: courseSection,
        schedule: schedule.trim() || null,
        teacher_id: teacherId || null,
        image_url: finalImageUrl
      }).select().single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      if (newCourse) {
        const inserts: { course_id: string; profile_id: string }[] = [];

        // Enroll teacher
        if (teacherId) {
          inserts.push({ course_id: newCourse.id, profile_id: teacherId });
        }

        // Auto-enroll all students from same section
        const studentIds = await getStudentsBySection(courseSection);
        studentIds.forEach((sid) => {
          if (sid !== teacherId) {
            inserts.push({ course_id: newCourse.id, profile_id: sid });
          }
        });

        if (inserts.length > 0) {
          await supabase.from("course_members").upsert(inserts, { ignoreDuplicates: true });
        }
      }
    }

    onSuccess();
    onClose();
  };


  if (!mounted) return null;

  const isAdmin = userRole === "admin";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[32rem] relative overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-container to-secondary" />

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {isEditing ? <Edit2 size={18} /> : <BookOpen size={18} />}
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">{isEditing ? "Editar Curso" : "Crear Curso"}</h3>
              <p className="text-label-sm text-on-surface-variant">{isEditing ? "Actualizar detalles de la asignatura" : "Registrar nueva asignatura"}</p>
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
            <label className="text-label-md font-bold text-on-surface" htmlFor="course-name">Nombre del Curso</label>
            <input
              id="course-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Historia Contemporánea"
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface" htmlFor="course-teacher">Docente Asignado</label>
            <select
              id="course-teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-60 disabled:bg-surface-container"
            >
              <option value="">Sin docente asignado</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
            {!isAdmin && (
              <p className="text-label-sm text-on-surface-variant">Solo los administradores pueden reasignar el docente.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Imagen de Referencia</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-outline-variant/50 overflow-hidden bg-surface-container flex items-center justify-center shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="text-on-surface-variant opacity-50" size={24} />
                )}
              </div>
              <div className="flex-1">
                <label className="inline-block px-4 py-2 bg-surface border border-outline-variant rounded-lg text-label-md font-bold text-on-surface hover:bg-surface-container transition-colors cursor-pointer">
                  <span>Seleccionar Imagen</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                <p className="text-label-sm text-on-surface-variant mt-1.5">Formatos recomendados: JPG, PNG. Máximo 2MB.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-md font-bold text-on-surface">Grado</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                required
                className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
              >
                {[1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g.toString()}>
                    {g}° Grado
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-label-md font-bold text-on-surface">Sección</label>
              <select
                value={sectionVal}
                onChange={(e) => setSectionVal(e.target.value)}
                required
                className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
              >
                {["A", "B", "C", "D", "E", "F", "G"].map((s) => (
                  <option key={s} value={s}>
                    Sección {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface" htmlFor="course-schedule">Horario (Opcional)</label>
            <input
              id="course-schedule"
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Ej: Lun, Mie 08:30"
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !name.trim()} className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {loading ? "Guardando..." : "Guardar Curso"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function CourseCard({ 
  course, 
  canEdit, 
  onEdit, 
  onDelete,
  onViewDetails
}: { 
  course: Course; 
  canEdit: boolean; 
  onEdit: () => void; 
  onDelete: () => void;
  onViewDetails: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatSection = (sec: string) => {
    if (!sec) return "Sin sección";
    const gradeMatch = sec.match(/[1-5]/);
    const sectionMatch = sec.match(/[A-G]/i);
    if (gradeMatch && sectionMatch) {
      return `${gradeMatch[0]}° Grado "${sectionMatch[0].toUpperCase()}"`;
    }
    return sec;
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/30 shadow-sm hover:shadow-md transition-all group flex flex-col h-full">
      <div className="h-32 relative overflow-hidden shrink-0">
        <img src={course.image_url || "https://images.unsplash.com/photo-1461360228754-6e81c478bc88?w=800"} alt={course.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 to-transparent"></div>
        <div className="absolute bottom-3 left-3 text-surface">
          <span className="text-label-sm font-bold bg-primary px-2 py-0.5 rounded-full">{formatSection(course.section)}</span>
        </div>
      </div>
      <div className="p-lg flex flex-col flex-1 justify-between">
        <div>
          <div className="flex justify-between items-start mb-sm relative">
            <h3 className="text-title-lg font-bold text-on-surface line-clamp-1 group-hover:text-primary transition-colors pr-8">{course.name}</h3>
            
            {canEdit && (
              <div className="absolute right-0 top-0" ref={menuRef}>
                <button 
                  onClick={() => setShowMenu(!showMenu)} 
                  className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  <MoreVertical size={20} />
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg overflow-hidden z-20 animate-fade-in origin-top-right">
                    <button 
                      onClick={() => { setShowMenu(false); onEdit(); }}
                      className="w-full text-left px-4 py-3 text-body-md font-medium text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors"
                    >
                      <Edit2 size={16} /> Editar Curso
                    </button>
                    <button 
                      onClick={() => { setShowMenu(false); onDelete(); }}
                      className="w-full text-left px-4 py-3 text-body-md font-medium text-error hover:bg-error/10 flex items-center gap-3 transition-colors border-t border-outline-variant/20"
                    >
                      <Trash2 size={16} /> Eliminar Curso
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-sm mb-md">
            <div className="flex items-center gap-sm text-on-surface-variant">
              <Users size={16} />
              <span className="text-body-md font-medium">{course._count?.members || 0} Participantes</span>
            </div>
            {course.teacher?.full_name && (
              <div className="flex items-center gap-sm text-on-surface-variant">
                <User size={16} className="text-primary" />
                <span className="text-body-md font-semibold text-primary truncate" title={course.teacher.full_name}>
                  Docente: {course.teacher.full_name}
                </span>
              </div>
            )}
            {course.schedule && (
              <div className="flex items-center gap-sm text-on-surface-variant">
                <Clock size={16} />
                <span className="text-body-md font-medium">{course.schedule}</span>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={onViewDetails}
          className="w-full py-sm rounded-lg border border-outline hover:bg-surface-container transition-colors flex items-center justify-center gap-sm font-bold text-label-md shrink-0"
        >
          Ver Detalles <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("student");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const fetchCourses = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const userRole = profile?.role || "student";
      setRole(userRole);

      let query = supabase
        .from("courses")
        .select(`
          *,
          teacher:profiles!teacher_id(full_name),
          course_members(count)
        `);

      if (userRole === "teacher") {
        query = query.eq("teacher_id", user.id);
      }

      const { data: coursesData, error } = await query.order("created_at", { ascending: false });

      if (!error && coursesData) {
        const formatted = coursesData.map(c => ({
          ...c,
          _count: { members: Array.isArray(c.course_members) ? c.course_members[0].count : (c.course_members?.count ?? 0) }
        }));
        setCourses(formatted as any);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleDelete = async (courseId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este curso? Se borrarán todas las tareas y entregas asociadas.")) return;
    
    const { error } = await supabase.from("courses").delete().eq("id", courseId).select().single();
    if (error) {
      alert("Error al eliminar el curso: " + error.message);
    } else {
      setCourses(prev => prev.filter(c => c.id !== courseId));
    }
  };

  const openCreateModal = () => {
    setEditingCourse(null);
    setIsModalOpen(true);
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setIsModalOpen(true);
  };

  const canCreate = role === "teacher" || role === "admin";

  return (
    <>
      {isModalOpen && (
        <CourseModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchCourses} 
          initialData={editingCourse}
          userRole={role}
        />
      )}

      <div className="space-y-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
          <div>
            <h2 className="text-headline-md font-bold text-on-surface">Mis Cursos</h2>
            <p className="text-body-md font-medium text-on-surface-variant mt-1">Gestiona tus asignaturas y estudiantes.</p>
          </div>
          {canCreate && (
            <button 
              onClick={openCreateModal}
              className="bg-primary hover:bg-primary-container text-on-primary font-bold text-label-md px-lg py-sm rounded-lg flex items-center gap-sm transition-colors shadow-sm"
            >
              <Plus size={18} /> Crear Curso
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-surface-container-lowest rounded-xl animate-pulse border border-outline-variant/30" />)}
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
              <BookOpen size={28} className="opacity-40" />
            </div>
            <p className="text-body-lg font-medium">No estás inscrito en ningún curso.</p>
            {canCreate && (
              <button onClick={openCreateModal} className="text-primary font-bold text-label-md hover:underline">
                Crear tu primer curso →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {courses.map((course) => (
              <CourseCard 
                key={course.id} 
                course={course}
                canEdit={role === "admin" || course.teacher_id === userId}
                onEdit={() => openEditModal(course)}
                onDelete={() => handleDelete(course.id)}
                onViewDetails={() => router.push(`/${role}/cursos/${course.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
