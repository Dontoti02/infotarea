/**
 * Iteración Nº 4 — Componente inteligente de InfoTarea.
 *
 * Tipos públicos del módulo `smart`:
 *   - Priorización de tareas y avisos (ítem 21).
 *   - Clasificación de tareas y resúmenes de entregas (ítem 22).
 *   - Alertas de seguimiento académico y correo saliente (ítem 23).
 */

import type {
  AlertCandidate,
  AlertType,
  ClassifiedTask,
  EmailSettingsDraft,
  PriorityLevel,
  RiskLevel,
  SmartMetrics,
  StudentDeliverySummary,
} from "@/shared/utils/prioritization";

export type {
  AlertCandidate,
  AlertType,
  ClassifiedTask,
  EmailSettingsDraft,
  PriorityLevel,
  RiskLevel,
  SmartMetrics,
  StudentDeliverySummary,
};

/** Alerta persistida en `smart_alerts` y visible en el panel. */
export interface StoredAlert {
  id: string;
  alert_type: AlertType;
  severity: AlertCandidate["severity"];
  title: string;
  message: string;
  student_id: string | null;
  task_id: string | null;
  course_id: string | null;
  metadata: Record<string, unknown>;
  dedupe_key: string;
  status: "pending" | "sent" | "failed" | "read";
  email_status: "not_sent" | "sent" | "failed";
  sent_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SmartScope {
  role: "admin" | "teacher" | "student" | "parent";
  label: string;
  courseIds: string[];
}

/** Resultado del análisis que alimenta el panel inteligente. */
export interface SmartOverview {
  scope: SmartScope;
  generatedAt: string;
  metrics: SmartMetrics;
  classified: ClassifiedTask[];
  summaries: StudentDeliverySummary[];
  alerts: StoredAlert[];
  courseNames: Record<string, string>;
}

/** Resumen devuelto por la ejecución del motor de alertas. */
export interface AlertSweepResult {
  generated: number;
  duplicates: number;
  emailsSent: number;
  emailsFailed: number;
  emailEnabled: boolean;
  backend: string;
  details: { alertType: AlertType; severity: string; title: string }[];
  errors: string[];
}

export interface EmailSettingsResponse {
  settings: EmailSettingsDraft;
  hasPassword: boolean;
  migrationPending?: boolean;
  backend: string;
}

export type { EmailSettingsValidation } from "@/shared/utils/prioritization";
export { ALERT_TYPE_LABELS, MASKED_SECRET, ALERT_CONFIG_DEFAULTS } from "@/shared/utils/prioritization";
