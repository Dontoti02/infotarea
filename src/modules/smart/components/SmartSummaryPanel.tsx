"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PRIORITY_LABELS,
  RISK_LABELS,
  SEVERITY_LABELS,
  formatHoursUntilDue,
  type PriorityLevel,
  type RiskLevel,
} from "@/shared/utils/prioritization";
import { loadSmartOverview } from "../services/smartService";
import type { AlertSweepResult, SmartOverview, StoredAlert } from "../types";

const LEVEL_STYLES: Record<PriorityLevel, string> = {
  critica: "bg-error/10 text-error border-error/25",
  alta: "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/30",
  media: "bg-primary/10 text-primary border-primary/25",
  baja: "bg-surface-container text-on-surface-variant border-outline-variant/40",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  en_riesgo: "bg-error/10 text-error border-error/25",
  observacion: "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/30",
  al_dia: "bg-secondary-container/30 text-on-secondary-container border-secondary/25",
  sin_actividad: "bg-surface-container text-on-surface-variant border-outline-variant/40",
};

const SEVERITY_STYLES: Record<string, string> = {
  critica: "bg-error/10 text-error border-error/25",
  alta: "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/30",
  media: "bg-primary/10 text-primary border-primary/25",
  informativa: "bg-surface-container text-on-surface-variant border-outline-variant/40",
};

const ALERT_ICONS: Record<string, React.ElementType> = {
  task_due_soon: CalendarClock,
  task_overdue: AlertTriangle,
  submission_pending_review: Inbox,
  student_at_risk: AlertTriangle,
  weekly_summary: Sparkles,
};

const STATUS_LABELS: Record<StoredAlert["status"], string> = {
  pending: "Pendiente",
  sent: "Enviada",
  failed: "Fallida",
  read: "Leída",
};

interface SmartSummaryPanelProps {
  role: "admin" | "teacher";
}

/**
 * Componente inteligente (ítem 22): clasifica las tareas por prioridad,
 * resume las entregas por estudiante y muestra las alertas generadas.
 * La dirección además puede ejecutar el motor de alertas y correos.
 */
export function SmartSummaryPanel({ role }: SmartSummaryPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [overview, setOverview] = useState<SmartOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);

  const fetchOverview = useCallback(async (): Promise<SmartOverview> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no encontrada. Vuelve a iniciar sesión.");
    return loadSmartOverview({ userId: user.id, role });
  }, [role, supabase]);

  const applyOverview = useCallback((data: SmartOverview) => {
    setOverview(data);
    setError(null);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchOverview()
      .then(applyOverview)
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el análisis inteligente."))
      .finally(() => setLoading(false));
  }, [fetchOverview, applyOverview]);

  useEffect(() => {
    let active = true;
    fetchOverview()
      .then(data => {
        if (active) applyOverview(data);
      })
      .catch(loadError => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el análisis inteligente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchOverview, applyOverview]);

  const handleSweep = async () => {
    setSweeping(true);
    setSweepMsg(null);
    try {
      const response = await fetch("/api/alerts/sweep", { method: "POST" });
      const data = await response.json() as { error?: string; result?: AlertSweepResult };
      if (!response.ok || !data.result) throw new Error(data.error || "No se pudieron generar las alertas.");
      const { generated, duplicates, emailsSent, emailsFailed, emailEnabled } = data.result;
      setSweepMsg(
        emailEnabled
          ? `Análisis ejecutado: ${generated} alertas nuevas, ${duplicates} omitidas por repetidas y ${emailsSent} correos enviados${emailsFailed ? ` (${emailsFailed} fallidos)` : ""}.`
          : `Análisis ejecutado: ${generated} alertas nuevas y ${duplicates} omitidas. El correo saliente está desactivado en Configuración.`,
      );
      await applyOverview(await fetchOverview());
    } catch (sweepError) {
      setSweepMsg(sweepError instanceof Error ? sweepError.message : "No se pudieron generar las alertas.");
    } finally {
      setSweeping(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-xl flex items-center justify-center gap-md">
        <Loader2 className="animate-spin text-primary" size={22} />
        <span className="text-body-md font-medium text-on-surface-variant">Analizando tareas y entregas…</span>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="bg-error/10 border border-error/20 text-error p-lg rounded-2xl">
        <div className="flex items-start gap-md">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-body-lg">No se pudo cargar el componente inteligente</p>
            <p className="text-body-md mt-xs">{error || "Inténtalo nuevamente."}</p>
            <button
              onClick={reload}
              className="mt-sm inline-flex items-center gap-1.5 bg-error text-on-error text-label-md font-bold px-3.5 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={14} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, classified, summaries, alerts, scope, generatedAt } = overview;
  const topTasks = classified.slice(0, 8);
  const topSummaries = summaries.slice(0, 8);
  const recentAlerts = alerts.slice(0, 8);

  const cards = [
    { label: "Prioridad crítica", value: metrics.critical, hint: "tareas por atender ya", icon: AlertTriangle, tone: "bg-error/10 text-error" },
    { label: "Tareas por vencer", value: metrics.dueSoon, hint: "en las próximas 48 h", icon: CalendarClock, tone: "bg-amber-400/20 text-amber-600 dark:text-amber-300" },
    { label: "Vencidas sin entrega", value: metrics.overdue, hint: "entregas atrasadas", icon: Inbox, tone: "bg-error/10 text-error" },
    { label: "Entregas por revisar", value: metrics.pendingReviews, hint: "pendientes de nota", icon: CheckCircle2, tone: "bg-primary/10 text-primary" },
    { label: "Estudiantes en riesgo", value: metrics.atRisk, hint: "requieren apoyo", icon: Users, tone: "bg-amber-400/20 text-amber-600 dark:text-amber-300" },
    { label: "Promedio general", value: metrics.averageScore ?? "—", hint: "escala 0 a 10", icon: Trophy, tone: "bg-tertiary/10 text-tertiary" },
  ];

  return (
    <section className="space-y-lg animate-fade-in">
      {/* Encabezado */}
      <div className="relative overflow-hidden bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-lg">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-md">
          <div className="flex items-start gap-md min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-title-lg font-bold text-on-surface">Componente inteligente de seguimiento</h3>
              <p className="text-body-md text-on-surface-variant mt-0.5">
                Clasificación de tareas por prioridad, resúmenes de entregas y alertas automáticas · {scope.label} ·
                análisis del {new Date(generatedAt).toLocaleString("es-ES")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-sm">
            <button
              onClick={reload}
              className="inline-flex items-center gap-sm border border-outline-variant/60 text-on-surface-variant font-bold text-label-md py-2 px-md rounded-xl hover:bg-surface-container transition-colors"
            >
              <RefreshCw size={15} /> Analizar ahora
            </button>
            {role === "admin" && (
              <button
                onClick={handleSweep}
                disabled={sweeping}
                className="inline-flex items-center gap-sm bg-primary text-on-primary font-bold text-label-md py-2 px-md rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50"
                title="Genera las alertas pendientes y envía los resúmenes por correo si está activo."
              >
                {sweeping ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                {sweeping ? "Ejecutando…" : "Generar y enviar alertas"}
              </button>
            )}
          </div>
        </div>
        {sweepMsg && (
          <div className="relative mt-md p-sm px-md rounded-xl bg-surface-container-low border border-outline-variant/50 text-label-md font-medium text-on-surface flex items-start gap-sm">
            <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
            <span>{sweepMsg}</span>
          </div>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-sm md:gap-md">
        {cards.map(card => (
          <div key={card.label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-md">
            <div className={`w-9 h-9 rounded-xl grid place-items-center ${card.tone}`}>
              <card.icon size={17} />
            </div>
            <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant mt-sm">{card.label}</p>
            <div className="flex items-baseline gap-xs mt-1">
              <span className="text-headline-md font-bold text-on-surface tabular-nums">{card.value}</span>
              <span className="text-label-sm text-on-surface-variant">{card.hint}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Clasificación y resúmenes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-lg items-start">
        {/* Tareas priorizadas */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/60 flex items-center justify-between gap-sm">
            <div>
              <h4 className="text-title-md font-bold text-on-surface">Tareas prioritarias</h4>
              <p className="text-label-sm text-on-surface-variant">Orden calculado por vencimiento, tipo y entregas</p>
            </div>
            <span className="text-label-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              {classified.length} {classified.length === 1 ? "tarea" : "tareas"}
            </span>
          </div>
          {topTasks.length === 0 ? (
            <div className="p-xl text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container grid place-items-center mb-md">
                <CalendarClock size={26} className="text-on-surface-variant/60" />
              </div>
              <p className="text-body-md font-bold text-on-surface">Sin tareas por clasificar</p>
              <p className="text-label-md text-on-surface-variant mt-xs">
                Cuando existan tareas en {role === "admin" ? "la institución" : "tus asignaturas"}, aparecerán aquí con su prioridad.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/15">
              {topTasks.map(task => (
                <li key={task.taskId} className="px-lg py-md flex items-start gap-md">
                  <span className={`mt-0.5 shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${LEVEL_STYLES[task.level]}`}>
                    {PRIORITY_LABELS[task.level]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md font-bold text-on-surface truncate" title={task.title}>{task.title}</p>
                    <p className="text-label-sm text-on-surface-variant mt-0.5 truncate">
                      {task.courseName || "Asignatura"} · {formatHoursUntilDue(task.hoursToDue)}
                    </p>
                    <div className="flex flex-wrap gap-xs mt-1.5">
                      {task.reasons.slice(0, 3).map(reason => (
                        <span key={reason} className="text-[10px] font-semibold bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-label-sm font-bold text-on-surface-variant tabular-nums" title="Puntaje de prioridad">
                    {task.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resumen de entregas */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/60 flex items-center justify-between gap-sm">
            <div>
              <h4 className="text-title-md font-bold text-on-surface">Resúmenes de entregas</h4>
              <p className="text-label-sm text-on-surface-variant">Avance y riesgo por estudiante</p>
            </div>
            <span className="text-label-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              {summaries.length} {summaries.length === 1 ? "estudiante" : "estudiantes"}
            </span>
          </div>
          {topSummaries.length === 0 ? (
            <div className="p-xl text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container grid place-items-center mb-md">
                <Users size={26} className="text-on-surface-variant/60" />
              </div>
              <p className="text-body-md font-bold text-on-surface">Sin estudiantes en el alcance</p>
              <p className="text-label-md text-on-surface-variant mt-xs">
                Matricula estudiantes en tus asignaturas para ver sus resúmenes de entregas.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/15">
              {topSummaries.map(summary => (
                <li key={summary.studentId} className="px-lg py-md">
                  <div className="flex items-center justify-between gap-sm">
                    <p className="text-body-md font-bold text-on-surface truncate">{summary.fullName}</p>
                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${RISK_STYLES[summary.riskLevel]}`}>
                      {RISK_LABELS[summary.riskLevel]}
                    </span>
                  </div>
                  <div className="flex items-center gap-md mt-1.5">
                    <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${summary.riskLevel === "en_riesgo" ? "bg-error" : summary.riskLevel === "observacion" ? "bg-amber-500" : "bg-secondary"}`}
                        style={{ width: `${Math.round(summary.progress * 100)}%` }}
                      />
                    </div>
                    <span className="text-label-sm font-bold text-on-surface-variant tabular-nums shrink-0">
                      {summary.submitted}/{summary.assignedTasks}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-xs mt-1.5 text-label-sm text-on-surface-variant">
                    <span className="bg-surface-container px-2 py-0.5 rounded-full">Nota: {summary.averageScore ?? "—"}</span>
                    {summary.overdue > 0 && <span className="bg-error/10 text-error px-2 py-0.5 rounded-full">{summary.overdue} vencidas</span>}
                    {summary.pendingReview > 0 && <span className="bg-amber-400/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">{summary.pendingReview} por revisar</span>}
                    {summary.notSubmitted > 0 && <span className="bg-surface-container px-2 py-0.5 rounded-full">{summary.notSubmitted} sin entregar</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Alertas generadas */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/60 flex items-center justify-between gap-sm">
          <div>
            <h4 className="text-title-md font-bold text-on-surface">Alertas de seguimiento generadas</h4>
            <p className="text-label-sm text-on-surface-variant">
              Avisos automáticos con control de duplicados; los correos dependen de la configuración de la dirección
            </p>
          </div>
          <span className="text-label-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
            {alerts.length} recientes
          </span>
        </div>
        {recentAlerts.length === 0 ? (
          <div className="p-xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container grid place-items-center mb-md">
              <Sparkles size={26} className="text-on-surface-variant/60" />
            </div>
            <p className="text-body-md font-bold text-on-surface">Todavía no hay alertas generadas</p>
            <p className="text-label-md text-on-surface-variant mt-xs max-w-md mx-auto">
              {role === "admin"
                ? "Usa «Generar y enviar alertas» para ejecutar el análisis de tareas próximas, entregas pendientes y estudiantes en riesgo."
                : "La dirección ejecuta el análisis periódicamente; las alertas de tus asignaturas aparecerán aquí."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/15">
            {recentAlerts.map(alert => {
              const Icon = ALERT_ICONS[alert.alert_type] || Sparkles;
              return (
                <li key={alert.id} className="px-lg py-md flex items-start gap-md">
                  <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 border ${SEVERITY_STYLES[alert.severity]}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-sm">
                      <p className="text-body-md font-bold text-on-surface">{alert.title}</p>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[alert.severity]}`}>
                        {SEVERITY_LABELS[alert.severity]}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${alert.status === "sent" ? "bg-secondary-container/30 text-on-secondary-container" : "bg-surface-container text-on-surface-variant"}`}>
                        {STATUS_LABELS[alert.status]}
                      </span>
                    </div>
                    <p className="text-label-md text-on-surface-variant mt-1 leading-relaxed">{alert.message}</p>
                    <p className="text-label-sm text-on-surface-variant/70 mt-1">
                      {new Date(alert.created_at).toLocaleString("es-ES")}
                      {alert.email_status === "sent" ? " · correo enviado" : alert.email_status === "failed" ? " · correo falló" : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
