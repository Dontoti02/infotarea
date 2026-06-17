"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  Shield,
  Users,
  School,
  ClipboardList,
  FileCheck,
  Megaphone,
  BookOpen,
  Clock,
  ChevronRight,
  Lock,
  GraduationCap,
  History,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { createPortal } from "react-dom";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface AcademicPeriod {
  id: string;
  year: number;        // DB column: year (INTEGER)
  label: string;       // DB column: label (TEXT)
  closed_at: string;
  closed_by: string;
  closed_by_name: string;
  total_students: number;
  total_teachers: number;
  total_courses: number;
  total_tasks: number;
  total_submissions: number;
  total_notices: number;
  total_resources: number;
}

interface CurrentStats {
  students: number;
  teachers: number;
  courses: number;
  tasks: number;
  submissions: number;
  notices: number;
  resources: number;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function YearCloseSection() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [currentStats, setCurrentStats] = useState<CurrentStats>({
    students: 0, teachers: 0, courses: 0,
    tasks: 0, submissions: 0, notices: 0, resources: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Close year modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<{ success: boolean; message: string } | null>(null);

  // Detail modal
  const [selectedPeriod, setSelectedPeriod] = useState<AcademicPeriod | null>(null);

  // Current academic year calculation
  const currentYear = new Date().getFullYear();
  const currentYearLabel = currentYear.toString();

  /* ─── Data Loading ─────────────────────────────────────────────────────── */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/close-year");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al cargar datos");
      }
      const data = await res.json();
      setPeriods(data.periods || []);
      setCurrentStats(data.currentStats || {
        students: 0, teachers: 0, courses: 0,
        tasks: 0, submissions: 0, notices: 0, resources: 0,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─── Close Year Handler ───────────────────────────────────────────────── */

  const handleCloseYear = async () => {
    if (confirmText !== "CERRAR AÑO") return;
    setClosing(true);
    setCloseResult(null);
    try {
      const res = await fetch("/api/admin/close-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearLabel: currentYearLabel,
          yearNumber: currentYear,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cerrar el año");
      setCloseResult({
        success: true,
        message: `Año ${currentYearLabel} cerrado exitosamente. Se archivaron ${data.period.stats.courses} cursos, ${data.period.stats.tasks} tareas, ${data.period.stats.submissions} entregas.`,
      });
      await loadData();
    } catch (err: any) {
      setCloseResult({ success: false, message: err.message });
    } finally {
      setClosing(false);
    }
  };

  /* ─── Helpers ──────────────────────────────────────────────────────────── */

  const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) => (
    <div className={`flex items-center gap-sm p-sm rounded-xl border border-outline-variant/20 ${color}`}>
      <div className="p-1.5 rounded-lg bg-white/60">{icon}</div>
      <div>
        <p className="text-headline-sm font-black text-on-surface leading-none">{value.toLocaleString()}</p>
        <p className="text-label-sm font-bold text-on-surface-variant">{label}</p>
      </div>
    </div>
  );

  /* ─── Loading / Error States ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-primary animate-spin" />
          <p className="text-body-md font-bold text-on-surface-variant">Cargando periodos académicos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4 bg-error-container/20 p-xl rounded-xl border border-error max-w-md text-center">
          <AlertCircle size={40} className="text-error" />
          <p className="text-body-lg font-bold text-error">Error al cargar datos</p>
          <p className="text-body-md text-on-surface-variant">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 px-6 py-2 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary-container transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const totalCurrentData = currentStats.tasks + currentStats.submissions + currentStats.notices + currentStats.resources;
  const hasDataToClose = totalCurrentData > 0;

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-xl">
      {/* ─── Current Period Card ──────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-tertiary-container/10 px-lg py-md border-b border-outline-variant/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-md">
              <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                <Calendar size={22} className="text-primary" />
              </div>
              <div>
                <h3 className="text-title-lg font-black text-on-surface">Periodo Actual</h3>
                <p className="text-label-md font-bold text-primary">Año Escolar {currentYearLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-xs px-3 py-1.5 bg-green-100 text-green-800 rounded-full border border-green-200">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-label-sm font-black uppercase tracking-wider">Activo</span>
            </div>
          </div>
        </div>

        <div className="p-lg">
          <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-md">Estadísticas del Año en Curso</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-md">
            <StatCard icon={<Users size={16} className="text-blue-600" />} label="Estudiantes" value={currentStats.students} color="bg-blue-50" />
            <StatCard icon={<GraduationCap size={16} className="text-indigo-600" />} label="Docentes" value={currentStats.teachers} color="bg-indigo-50" />
            <StatCard icon={<School size={16} className="text-violet-600" />} label="Cursos" value={currentStats.courses} color="bg-violet-50" />
            <StatCard icon={<ClipboardList size={16} className="text-amber-600" />} label="Tareas" value={currentStats.tasks} color="bg-amber-50" />
            <StatCard icon={<FileCheck size={16} className="text-emerald-600" />} label="Entregas" value={currentStats.submissions} color="bg-emerald-50" />
            <StatCard icon={<Megaphone size={16} className="text-rose-600" />} label="Avisos" value={currentStats.notices} color="bg-rose-50" />
            <StatCard icon={<BookOpen size={16} className="text-cyan-600" />} label="Recursos" value={currentStats.resources} color="bg-cyan-50" />
          </div>

          {/* Close Year Button */}
          <div className="mt-xl pt-lg border-t border-outline-variant/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md">
              <div className="flex items-start gap-sm">
                <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-body-md font-bold text-on-surface">Cierre de Año Académico</p>
                  <p className="text-label-sm font-medium text-on-surface-variant">
                    Archiva toda la información del año actual y reinicia el sistema para el nuevo ciclo escolar.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowCloseModal(true); setConfirmText(""); setCloseResult(null); }}
                disabled={!hasDataToClose}
                className={`shrink-0 flex items-center gap-sm px-6 py-3 rounded-xl font-black text-label-md transition-all active:scale-95 shadow-sm ${
                  hasDataToClose
                    ? "bg-error text-on-error hover:bg-error/90 cursor-pointer hover:shadow-md"
                    : "bg-outline-variant/30 text-on-surface-variant cursor-not-allowed"
                }`}
              >
                <Archive size={18} />
                Cerrar Año {currentYearLabel}
              </button>
            </div>
            {!hasDataToClose && (
              <p className="text-label-sm font-bold text-on-surface-variant mt-sm ml-7">
                No hay datos operativos para archivar. El sistema ya está limpio para el nuevo año.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── History Section ─────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-md">
            <div className="p-2 bg-secondary-container/30 rounded-xl">
              <History size={20} className="text-secondary" />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">Historial de Periodos</h3>
              <p className="text-label-sm font-medium text-on-surface-variant">
                {periods.length} {periods.length === 1 ? "periodo archivado" : "periodos archivados"}
              </p>
            </div>
          </div>
          <button onClick={loadData} className="p-2 hover:bg-surface-container rounded-full text-outline transition-colors" title="Actualizar">
            <RefreshCw size={18} />
          </button>
        </div>

        {periods.length === 0 ? (
          <div className="p-xl text-center">
            <div className="inline-flex p-4 bg-surface-container rounded-2xl mb-md">
              <Archive size={36} className="text-outline-variant" />
            </div>
            <p className="text-body-lg font-bold text-on-surface-variant">Sin periodos anteriores</p>
            <p className="text-body-md text-on-surface-variant mt-xs">
              Aquí aparecerán los periodos académicos que cierres en el futuro.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {periods.map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period)}
                className="w-full flex items-center gap-lg px-lg py-md hover:bg-surface-container-low/50 transition-all text-left group cursor-pointer"
              >
                <div className="shrink-0 w-20 h-20 bg-gradient-to-br from-primary/10 to-secondary-container/30 rounded-2xl flex flex-col items-center justify-center border border-outline-variant/20 group-hover:border-primary/30 transition-colors">
                  <span className="text-label-sm font-black text-primary uppercase tracking-wider">Año</span>
                  <span className="text-title-md font-black text-on-surface leading-none">{period.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-lg font-black text-on-surface mb-0.5">Año Escolar {period.label}</p>
                  <p className="text-label-sm font-medium text-on-surface-variant flex items-center gap-xs">
                    <Clock size={12} />
                    Cerrado el {new Date(period.closed_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    {" · por "}{period.closed_by_name}
                  </p>
                  <div className="flex flex-wrap items-center gap-md mt-sm text-label-sm text-on-surface-variant font-bold">
                    <span className="flex items-center gap-xs"><School size={12} /> {period.total_courses} cursos</span>
                    <span className="flex items-center gap-xs"><ClipboardList size={12} /> {period.total_tasks} tareas</span>
                    <span className="flex items-center gap-xs"><FileCheck size={12} /> {period.total_submissions} entregas</span>
                    <span className="flex items-center gap-xs"><Users size={12} /> {period.total_students} estudiantes</span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-outline-variant group-hover:text-primary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Close Year Confirmation Modal ────────────────────────────────── */}
      {showCloseModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="bg-error/5 border-b border-error/20 px-lg py-md flex items-center justify-between">
              <div className="flex items-center gap-sm">
                <div className="p-2 bg-error/10 rounded-xl"><AlertTriangle size={20} className="text-error" /></div>
                <h3 className="text-title-lg font-black text-error">Cerrar Año Académico</h3>
              </div>
              <button onClick={() => setShowCloseModal(false)} disabled={closing} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-lg space-y-md">
              {closeResult ? (
                <div className={`p-md rounded-xl border ${closeResult.success ? "bg-green-50 border-green-200" : "bg-error-container/20 border-error/20"}`}>
                  <div className="flex items-start gap-sm">
                    {closeResult.success
                      ? <CheckCircle2 size={24} className="text-green-600 shrink-0 mt-0.5" />
                      : <AlertCircle size={24} className="text-error shrink-0 mt-0.5" />}
                    <div>
                      <p className={`text-body-md font-bold ${closeResult.success ? "text-green-800" : "text-error"}`}>
                        {closeResult.success ? "¡Cierre completado!" : "Error al cerrar año"}
                      </p>
                      <p className={`text-body-sm mt-xs ${closeResult.success ? "text-green-700" : "text-on-surface-variant"}`}>
                        {closeResult.message}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-md">
                    <p className="text-body-md font-bold text-amber-800 flex items-center gap-xs mb-xs">
                      <Shield size={16} /> Acción irreversible
                    </p>
                    <p className="text-body-sm text-amber-700">
                      Esta operación archivará toda la información del <strong>Año Escolar {currentYearLabel}</strong> y limpiará las tablas para el nuevo ciclo. Los datos se guardarán en el historial.
                    </p>
                  </div>

                  <div className="bg-surface rounded-xl border border-outline-variant/30 p-md">
                    <p className="text-label-sm font-black text-on-surface-variant uppercase tracking-wider mb-sm">
                      Se archivarán los siguientes datos:
                    </p>
                    <div className="grid grid-cols-2 gap-xs text-body-sm">
                      {[
                        { icon: <School size={14} className="text-primary" />, text: `${currentStats.courses} cursos` },
                        { icon: <ClipboardList size={14} className="text-primary" />, text: `${currentStats.tasks} tareas` },
                        { icon: <FileCheck size={14} className="text-primary" />, text: `${currentStats.submissions} entregas` },
                        { icon: <Megaphone size={14} className="text-primary" />, text: `${currentStats.notices} avisos` },
                        { icon: <BookOpen size={14} className="text-primary" />, text: `${currentStats.resources} recursos` },
                        { icon: <Users size={14} className="text-primary" />, text: `${currentStats.students} estudiantes inscritos` },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-xs text-on-surface font-medium">
                          {item.icon} {item.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-md">
                    <p className="text-body-sm font-bold text-blue-800 mb-xs">¿Qué se conserva?</p>
                    <ul className="text-body-sm text-blue-700 space-y-0.5">
                      <li className="flex items-center gap-xs"><CheckCircle2 size={12} /> Usuarios (perfiles, credenciales)</li>
                      <li className="flex items-center gap-xs"><CheckCircle2 size={12} /> Cursos (estructura base sin datos)</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-label-md font-bold text-on-surface mb-xs">
                      Escribe <span className="text-error font-black">CERRAR AÑO</span> para confirmar
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={16} className="text-outline-variant" />
                      </div>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="CERRAR AÑO"
                        className="w-full pl-10 bg-surface border border-outline-variant rounded-xl p-sm text-body-md text-on-surface focus:ring-2 focus:ring-error outline-none transition-all font-bold uppercase tracking-wider"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-lg py-md border-t border-outline-variant/30 flex justify-end gap-sm">
              {closeResult ? (
                <button
                  onClick={() => { setShowCloseModal(false); setCloseResult(null); }}
                  className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-label-md hover:bg-primary-container transition-colors active:scale-95"
                >
                  Entendido
                </button>
              ) : (
                <>
                  <button onClick={() => setShowCloseModal(false)} disabled={closing} className="px-5 py-2.5 text-on-surface-variant font-bold text-label-md hover:bg-surface-container rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleCloseYear}
                    disabled={confirmText !== "CERRAR AÑO" || closing}
                    className={`flex items-center gap-sm px-6 py-2.5 rounded-xl font-black text-label-md transition-all active:scale-95 ${
                      confirmText === "CERRAR AÑO" && !closing
                        ? "bg-error text-on-error hover:bg-error/90 cursor-pointer shadow-sm"
                        : "bg-outline-variant/30 text-on-surface-variant cursor-not-allowed"
                    }`}
                  >
                    {closing ? (<><Loader2 size={16} className="animate-spin" /> Cerrando año...</>) : (<><Archive size={16} /> Confirmar Cierre</>)}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Period Detail Modal ─────────────────────────────────────────── */}
      {selectedPeriod && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-2xl overflow-hidden animate-scale-up max-h-[85vh] flex flex-col">
            <div className="bg-gradient-to-r from-primary/8 to-secondary-container/10 px-lg py-md border-b border-outline-variant/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-md">
                <div className="w-14 h-14 bg-gradient-to-br from-primary/15 to-secondary-container/30 rounded-2xl flex flex-col items-center justify-center border border-primary/20">
                  <span className="text-[9px] font-black text-primary uppercase tracking-wider">Año</span>
                  <span className="text-title-sm font-black text-on-surface leading-none">{selectedPeriod.label}</span>
                </div>
                <div>
                  <h3 className="text-title-lg font-black text-on-surface">Año Escolar {selectedPeriod.label}</h3>
                  <p className="text-label-sm font-medium text-on-surface-variant flex items-center gap-xs">
                    <Clock size={12} />
                    Cerrado el {new Date(selectedPeriod.closed_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · por "}{selectedPeriod.closed_by_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedPeriod(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-lg space-y-lg scrollbar-thin">
              <div>
                <p className="text-label-sm font-black text-on-surface-variant uppercase tracking-wider mb-md">Resumen del Periodo</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
                  {[
                    { icon: <Users size={18} className="text-blue-600" />, label: "Estudiantes", value: selectedPeriod.total_students, bg: "bg-blue-50 border-blue-100" },
                    { icon: <GraduationCap size={18} className="text-indigo-600" />, label: "Docentes", value: selectedPeriod.total_teachers, bg: "bg-indigo-50 border-indigo-100" },
                    { icon: <School size={18} className="text-violet-600" />, label: "Cursos", value: selectedPeriod.total_courses, bg: "bg-violet-50 border-violet-100" },
                    { icon: <ClipboardList size={18} className="text-amber-600" />, label: "Tareas", value: selectedPeriod.total_tasks, bg: "bg-amber-50 border-amber-100" },
                    { icon: <FileCheck size={18} className="text-emerald-600" />, label: "Entregas", value: selectedPeriod.total_submissions, bg: "bg-emerald-50 border-emerald-100" },
                    { icon: <Megaphone size={18} className="text-rose-600" />, label: "Avisos", value: selectedPeriod.total_notices, bg: "bg-rose-50 border-rose-100" },
                    { icon: <BookOpen size={18} className="text-cyan-600" />, label: "Recursos", value: selectedPeriod.total_resources, bg: "bg-cyan-50 border-cyan-100" },
                  ].map((stat) => (
                    <div key={stat.label} className={`${stat.bg} border rounded-xl p-md flex flex-col items-center gap-xs text-center`}>
                      {stat.icon}
                      <span className="text-headline-sm font-black text-on-surface">{stat.value.toLocaleString()}</span>
                      <span className="text-label-sm font-bold text-on-surface-variant">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-xl border border-outline-variant/30 p-md">
                <div className="flex items-center gap-sm">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Archive size={18} className="text-green-700" />
                  </div>
                  <div>
                    <p className="text-body-md font-bold text-on-surface">Datos Archivados Correctamente</p>
                    <p className="text-label-sm font-medium text-on-surface-variant">
                      Toda la información de este periodo fue archivada de forma segura al momento del cierre.
                    </p>
                  </div>
                </div>
              </div>

              {currentStats.courses > 0 && (
                <div className="bg-primary/3 rounded-xl border border-primary/10 p-md">
                  <p className="text-label-sm font-black text-primary uppercase tracking-wider mb-sm flex items-center gap-xs">
                    <TrendingUp size={14} /> Comparación con el periodo actual
                  </p>
                  <div className="grid grid-cols-3 gap-md text-center">
                    {[
                      { label: "Cursos", prev: selectedPeriod.total_courses, curr: currentStats.courses },
                      { label: "Tareas", prev: selectedPeriod.total_tasks, curr: currentStats.tasks },
                      { label: "Entregas", prev: selectedPeriod.total_submissions, curr: currentStats.submissions },
                    ].map((cmp) => {
                      const diff = cmp.curr - cmp.prev;
                      const pct = cmp.prev > 0 ? Math.round((diff / cmp.prev) * 100) : 0;
                      return (
                        <div key={cmp.label}>
                          <p className="text-label-sm font-bold text-on-surface-variant">{cmp.label}</p>
                          <p className="text-body-md font-bold text-on-surface">{cmp.prev} → {cmp.curr}</p>
                          {cmp.prev > 0 && (
                            <span className={`text-label-sm font-black ${diff >= 0 ? "text-green-600" : "text-error"}`}>
                              {diff >= 0 ? "+" : ""}{pct}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-lg py-md border-t border-outline-variant/30 flex justify-end shrink-0">
              <button onClick={() => setSelectedPeriod(null)} className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-label-md hover:bg-primary-container transition-colors active:scale-95">
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
