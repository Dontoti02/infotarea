/**
 * Motor de alertas inteligentes (ítems 21–23).
 * Reglas puras + persistencia elevada + envío de correo, en un solo flujo:
 *   1. Carga tareas, entregas, cursos y reglas configuradas.
 *   2. Genera avisos con `buildAlertCandidates` (sin duplicados por `dedupe_key`).
 *   3. Guarda las alertas nuevas en `smart_alerts` (siempre visibles en la app).
 *   4. Si el correo está activo, envía un resumen por destinatario y lo registra.
 */

import {
  buildAlertCandidates,
  buildEmailDigests,
  isSmtpConfigured,
  type AlertAudience,
} from "@/shared/utils/prioritization";
import {
  appendEmailLogs,
  loadSweepSnapshot,
  readEmailConfig,
  finalizeAlertEmails,
  writeSmartAlerts,
  type AdminBackend,
} from "./adminData";
import { sendDigestEmails } from "./emailService";
import type { AlertSweepResult } from "../types";

export interface SweepOptions {
  /** Momento del análisis (inyectable en pruebas). */
  now?: Date;
}

export async function runAlertSweep(options: SweepOptions = {}): Promise<AlertSweepResult> {
  const now = options.now || new Date();
  const snapshot = await loadSweepSnapshot();
  const emailConfig = await readEmailConfig();

  const candidates = buildAlertCandidates(
    {
      tasks: snapshot.tasks,
      submissions: snapshot.submissions,
      people: snapshot.people,
      courses: snapshot.courses,
      memberships: snapshot.memberships,
      parentLinks: snapshot.parentLinks,
    },
    now,
    snapshot.alertRules,
  ).filter(candidate => snapshot.enabledTypes[candidate.alertType]);

  const inserted = await writeSmartAlerts(candidates.map(candidate => ({
    alertType: candidate.alertType,
    severity: candidate.severity,
    title: candidate.title,
    message: candidate.message,
    studentId: candidate.studentId,
    taskId: candidate.taskId,
    courseId: candidate.courseId,
    metadata: candidate.metadata,
    dedupeKey: candidate.dedupeKey,
  })));

  const insertedByKey = new Map(inserted.map(row => [row.dedupe_key, row]));
  const result: AlertSweepResult = {
    generated: inserted.length,
    duplicates: candidates.length - inserted.length,
    emailsSent: 0,
    emailsFailed: 0,
    emailEnabled: isSmtpConfigured(emailConfig.settings, Boolean(emailConfig.password)),
    backend: snapshot.backend satisfies AdminBackend,
    details: inserted.map(row => ({ alertType: row.alert_type, severity: row.severity, title: row.title })),
    errors: [],
  };

  if (inserted.length === 0) return result;

  const mailCandidates = candidates.filter(candidate =>
    insertedByKey.has(candidate.dedupeKey) && emailConfig.settings.alert_config[candidate.alertType],
  );

  if (!result.emailEnabled || mailCandidates.length === 0) return result;

  const digests = buildEmailDigests(mailCandidates);
  const outcomes = await sendDigestEmails(
    { settings: emailConfig.settings, password: emailConfig.password },
    digests,
  );

  const updates: { id: string; ok: boolean; sentAt?: string }[] = [];
  const sentAt = now.toISOString();
  for (const outcome of outcomes) {
    const alertIds = outcome.digest.alerts
      .map(alert => insertedByKey.get(alert.dedupeKey)?.id)
      .filter((id): id is string => Boolean(id));
    if (outcome.result.ok) {
      result.emailsSent += 1;
      updates.push(...alertIds.map(id => ({ id, ok: true, sentAt })));
    } else {
      result.emailsFailed += 1;
      if (outcome.result.error) result.errors.push(`${outcome.digest.to}: ${outcome.result.error}`);
      updates.push(...alertIds.map(id => ({ id, ok: false })));
    }
    const onlyWeekly = outcome.digest.alerts.every(alert => alert.alertType === "weekly_summary");
    await appendEmailLogs([{
      alertIds,
      toEmail: outcome.digest.to,
      subject: outcome.digest.subject,
      kind: onlyWeekly ? "weekly_summary" : "alert_digest",
      status: outcome.result.ok ? "sent" : "failed",
      errorMessage: outcome.result.error ?? null,
      providerMessageId: outcome.result.messageId ?? null,
    }]).catch(error => {
      result.errors.push(`No se pudo registrar la bitácora de ${outcome.digest.to}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  if (updates.length > 0) {
    await finalizeAlertEmails(updates).catch(error => {
      result.errors.push(`No se pudo actualizar el estado de las alertas: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  return result;
}

export function audienceEmails(audience: AlertAudience[]): string[] {
  return audience.map(person => person.email).filter((email): email is string => Boolean(email && email.includes("@")));
}
