"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  SEVERITY_LABELS,
  studentAlertTitle,
  type AlertSeverity,
} from "@/shared/utils/prioritization";
import { loadStudentAlerts } from "../services/smartService";
import type { StoredAlert } from "../types";

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critica: "bg-error/10 text-error border-error/25",
  alta: "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/30",
  media: "bg-primary/10 text-primary border-primary/25",
  informativa: "bg-surface-container text-on-surface-variant border-outline-variant/40",
};

function formatAlertDate(value: string): string {
  return new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Avisos personales del componente inteligente (ítems 22–23).
 *
 * Muestra dentro de la plataforma los avisos que el motor generó para este
 * estudiante (por ejemplo, bajo rendimiento detectado). La política de RLS
 * «Estudiantes ven sus propias alertas» garantiza que cada alumno solo lee sus
 * propias filas. El correo del bajo rendimiento va solo a docentes y padres;
 * este panel es el canal del estudiante dentro del sistema.
 */
export function StudentSmartAlerts() {
  const supabase = useMemo(() => createClient(), []);
  const [alerts, setAlerts] = useState<StoredAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async (): Promise<StoredAlert[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no encontrada. Vuelve a iniciar sesión.");
    return loadStudentAlerts({ userId: user.id, client: supabase });
  }, [supabase]);

  const applyAlerts = useCallback((data: StoredAlert[]) => {
    setAlerts(data);
    setError(null);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAlerts()
      .then(applyAlerts)
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar tus avisos."))
      .finally(() => setLoading(false));
  }, [fetchAlerts, applyAlerts]);

  useEffect(() => {
    let active = true;
    fetchAlerts()
      .then(data => {
        if (active) applyAlerts(data);
      })
      .catch(loadError => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar tus avisos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchAlerts, applyAlerts]);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-lg flex items-center justify-center gap-md">
        <Loader2 className="animate-spin text-primary" size={20} />
        <span className="text-body-md font-medium text-on-surface-variant">Revisando tus avisos de seguimiento…</span>
      </div>
    );
  }

  if (error || !alerts) {
    return (
      <div className="bg-error/10 border border-error/20 text-error p-lg rounded-2xl">
        <div className="flex items-start gap-md">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-body-lg">No se pudieron cargar tus avisos</p>
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

  if (alerts.length === 0) {
    return (
      <div className="bg-secondary-container/20 border border-secondary/25 rounded-2xl p-lg flex items-start gap-md">
        <CheckCircle2 size={22} className="text-secondary shrink-0 mt-0.5" />
        <div>
          <p className="text-title-md font-bold text-on-surface">Sin avisos de seguimiento</p>
          <p className="text-body-md text-on-surface-variant mt-xs">
            Tu rendimiento está al día. Si el componente inteligente detecta algo que requiera tu atención, lo verás aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
      <header className="px-lg pt-lg pb-md border-b border-outline-variant/30">
        <h3 className="text-title-lg font-bold text-on-surface">Avisos de seguimiento académico</h3>
        <p className="text-body-md text-on-surface-variant mt-xs">
          El componente inteligente marca aquí las situaciones que requieren tu atención.
        </p>
      </header>
      <ul className="divide-y divide-outline-variant/30">
        {alerts.map(alert => (
          <li key={alert.id} className="px-lg py-md flex flex-col gap-xs">
            <div className="flex flex-wrap items-center gap-sm">
              <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase tracking-wide ${SEVERITY_STYLES[alert.severity]}`}>
                {SEVERITY_LABELS[alert.severity]}
              </span>
              <h4 className="text-title-md font-bold text-on-surface">
                {studentAlertTitle(alert.alert_type, alert.title)}
              </h4>
            </div>
            <p className="text-body-md text-on-surface-variant">{alert.message}</p>
            <div className="flex flex-wrap items-center gap-md text-label-sm text-on-surface-variant/80">
              <span>{formatAlertDate(alert.created_at)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
