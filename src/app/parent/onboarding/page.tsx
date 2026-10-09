"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  UserCheck, 
  UserPlus, 
  Trash2, 
  ArrowRight, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  BookOpen,
  Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface StudentResult {
  id: string;
  full_name: string;
  email?: string;
  section: string;
  course_name: string;
  courses_count: number;
  detectedGrade?: string;
}

interface LinkedChild {
  id: string;
  full_name: string;
  section: string;
  courses_count: number;
}

export default function ParentOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  // Search filters
  const [nameQuery, setNameQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");

  // States
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChild[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Load existing linked children on mount
  useEffect(() => {
    async function loadCurrentLinks() {
      try {
        const res = await fetch("/api/parents/children");
        const data = await res.json();
        if (data.children) {
          setLinkedChildren(
            data.children.map((c: any) => ({
              id: c.id,
              full_name: c.full_name,
              section: c.section,
              courses_count: c.courses?.length || 0,
            }))
          );
        }
      } catch (e) {
        console.error("Error loading linked children:", e);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadCurrentLinks();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearching(true);
    setMessage(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      if (nameQuery.trim()) params.set("name", nameQuery.trim());
      if (gradeFilter !== "all") params.set("grade", gradeFilter);
      if (sectionFilter !== "all") params.set("section", sectionFilter);

      const res = await fetch(`/api/parents/search-students?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al buscar estudiantes");
      }

      setSearchResults(data.students || []);
    } catch (err: any) {
      setMessage({ text: err.message || "Error en la búsqueda", type: "error" });
    } finally {
      setSearching(false);
    }
  };

  const handleLinkChild = async (student: StudentResult) => {
    setLinkingId(student.id);
    setMessage(null);

    try {
      const res = await fetch("/api/parents/link-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo vincular al estudiante");
      }

      // Add to linked children
      if (!linkedChildren.some((c) => c.id === student.id)) {
        setLinkedChildren((prev) => [
          ...prev,
          {
            id: student.id,
            full_name: student.full_name,
            section: student.section,
            courses_count: student.courses_count,
          },
        ]);
      }

      setMessage({
        text: `¡${student.full_name} fue vinculado exitosamente!`,
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al vincular", type: "error" });
    } finally {
      setLinkingId(null);
    }
  };

  const handleUnlinkChild = async (studentId: string) => {
    setUnlinkingId(studentId);
    setMessage(null);

    try {
      const res = await fetch(`/api/parents/link-child?studentId=${studentId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo desvincular");
      }

      setLinkedChildren((prev) => prev.filter((c) => c.id !== studentId));
      setMessage({ text: "Hijo desvinculado de la cuenta", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al desvincular", type: "error" });
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleFinish = () => {
    router.push("/parent/dashboard");
  };

  return (
    <div className="min-h-screen bg-surface p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} />
              <span>Configuración Familiar</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface">
              Vincula a tus hijos
            </h1>
            <p className="text-sm md:text-base text-on-surface-variant max-w-2xl">
              Busca a tu hijo por sus nombres completos, grado y sección. Si tienes más de un hijo en la institución, podrás agregarlo también a continuación.
            </p>
          </div>

          {/* Quick status */}
          <div className="shrink-0 bg-surface-container-low px-5 py-3 rounded-2xl border border-outline-variant/20 text-center">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
              Hijos vinculados
            </span>
            <span className="text-2xl font-black text-primary">
              {linkedChildren.length}
            </span>
          </div>
        </div>

        {/* Feedback message */}
        {message && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium animate-fade-in ${
              message.type === "success"
                ? "bg-secondary/10 border border-secondary/20 text-secondary"
                : "bg-error/10 border border-error/20 text-error"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Search Card */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/30 space-y-6">
          <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-4">
            <Search className="text-primary" size={22} />
            <h2 className="text-lg font-bold text-on-surface">
              Buscar estudiante en la institución
            </h2>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Nombres completos */}
              <div className="md:col-span-6 space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Nombres completos del hijo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="Ej: Luis Vera, Juan..."
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Grado */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Grado
                </label>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full px-3 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer"
                >
                  <option value="all">Todos los grados</option>
                  <option value="1">1° Grado / 1ro</option>
                  <option value="2">2° Grado / 2do</option>
                  <option value="3">3° Grado / 3ro</option>
                  <option value="4">4° Grado / 4to</option>
                  <option value="5">5° Grado / 5to</option>
                </select>
              </div>

              {/* Sección */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Sección
                </label>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full px-3 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer"
                >
                  <option value="all">Todas las secciones</option>
                  <option value="A">Sección A</option>
                  <option value="B">Sección B</option>
                  <option value="C">Sección C</option>
                  <option value="D">Sección D</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={searching}
                className="px-6 py-3 rounded-xl bg-primary-container text-on-primary font-bold text-sm hover:bg-primary transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                {searching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                <span>{searching ? "Buscando..." : "Buscar Estudiante"}</span>
              </button>
            </div>
          </form>

          {/* Search Results Display */}
          {hasSearched && (
            <div className="mt-6 pt-6 border-t border-outline-variant/20 space-y-4">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                Resultados encontrados ({searchResults.length})
              </h3>

              {searchResults.length === 0 ? (
                <div className="p-8 text-center bg-surface rounded-2xl border border-dashed border-outline-variant/40">
                  <GraduationCap className="mx-auto text-outline-variant mb-2" size={36} />
                  <p className="text-sm font-semibold text-on-surface">No se encontraron estudiantes con esos criterios</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Prueba dejando el nombre vacío para ver todos los estudiantes del grado o revisa la ortografía.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((student) => {
                    const isAlreadyLinked = linkedChildren.some((c) => c.id === student.id);
                    const isLinking = linkingId === student.id;

                    return (
                      <div
                        key={student.id}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                          isAlreadyLinked
                            ? "bg-secondary/5 border-secondary/30"
                            : "bg-surface border-outline-variant/30 hover:border-primary/40 shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-base shrink-0">
                            {student.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-on-surface truncate">
                              {student.full_name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-on-surface-variant">
                              <span className="font-semibold text-primary">
                                Sección: {student.section}
                              </span>
                              <span>•</span>
                              <span>{student.course_name}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isAlreadyLinked ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/15 text-secondary font-bold text-xs">
                              <CheckCircle2 size={14} />
                              <span>Vinculado</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleLinkChild(student)}
                              disabled={isLinking}
                              className="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                              {isLinking ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <UserPlus size={14} />
                              )}
                              <span>Vincular</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Currently Linked Children Section */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/30 space-y-6">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
            <div className="flex items-center gap-2">
              <UserCheck className="text-secondary" size={22} />
              <h2 className="text-lg font-bold text-on-surface">
                Hijos vinculados a tu cuenta ({linkedChildren.length})
              </h2>
            </div>
            {linkedChildren.length > 0 && (
              <span className="text-xs text-on-surface-variant font-medium">
                Puedes agregar más usando el buscador superior
              </span>
            )}
          </div>

          {loadingInitial ? (
            <div className="p-8 text-center">
              <Loader2 className="mx-auto animate-spin text-primary" size={28} />
              <p className="text-xs text-on-surface-variant mt-2">Cargando vinculaciones...</p>
            </div>
          ) : linkedChildren.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-2xl border border-dashed border-outline-variant/40 space-y-2">
              <Users className="mx-auto text-outline-variant" size={36} />
              <p className="text-sm font-semibold text-on-surface">Aún no has vinculado a ningún hijo</p>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                Utiliza el buscador de arriba con el nombre completo y grado de tu hijo para agregarlo a tu cuenta.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {linkedChildren.map((child) => (
                  <div
                    key={child.id}
                    className="p-4 rounded-2xl bg-surface border border-outline-variant/30 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-secondary/15 text-secondary font-bold flex items-center justify-center text-lg shrink-0">
                        {child.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-on-surface truncate">
                            {child.full_name}
                          </h4>
                          <span className="inline-block px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-[11px] font-bold">
                            Hijo
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Sección: <span className="font-semibold text-on-surface">{child.section}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnlinkChild(child.id)}
                      disabled={unlinkingId === child.id}
                      title="Desvincular hijo"
                      className="p-2 rounded-xl text-outline hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                    >
                      {unlinkingId === child.id ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Informative banner about adding more children */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15 flex items-center gap-3 text-xs text-on-surface-variant">
                <Users className="text-primary shrink-0" size={20} />
                <span>
                  <strong>¿Tienes otro hijo en la escuela?</strong> Puedes buscarlo arriba y vincularlo en cualquier momento. Ambos aparecerán en tu panel familiar.
                </span>
              </div>
            </div>
          )}

          {/* Bottom Action Button */}
          <div className="pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-on-surface-variant">
              {linkedChildren.length === 0
                ? "Debes vincular al menos un hijo para ingresar al dashboard."
                : `Todo listo con ${linkedChildren.length} hijo(s) vinculado(s).`}
            </p>

            <button
              onClick={handleFinish}
              disabled={linkedChildren.length === 0}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-container text-on-primary font-bold text-sm hover:bg-primary transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Continuar al Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
