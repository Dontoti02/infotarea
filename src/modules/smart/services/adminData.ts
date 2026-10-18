/**
 * Acceso elevado a datos para las funciones administrativas del módulo smart
 * (configuración de correo, contraseña SMTP y ejecución de alertas).
 *
 * Estrategia: usa la clave de servicio de Supabase cuando existe; si no está
 * configurada o falla, cae a una conexión directa de PostgreSQL (DATABASE_URL),
 * igual que lo hace el alta de usuarios existente. La contraseña SMTP nunca se
 * expone a sesiones de navegador: `email_secrets` no tiene políticas de RLS.
 */

import { createClient as createVanillaClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AlertRules,
  CourseRecord,
  EmailSettingsDraft,
  MembershipRecord,
  ParentStudentLinkRecord,
  PersonRecord,
  SubmissionRecord,
  TaskRecord,
  AlertType,
} from "@/shared/utils/prioritization";
import { mergeAlertRules, normalizeStoredEmailSettings } from "@/shared/utils/prioritization";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres.vafrsmzqzgfuamrrtyob:dS3Kvv8GkhpStrGR@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

export type AdminBackend = "service-role" | "postgres";

export class AdminDataError extends Error {
  code: string;
  constructor(message: string, code = "admin_data_unavailable") {
    super(message);
    this.name = "AdminDataError";
    this.code = code;
  }
}

function serviceCredentials(): { url: string; key: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vafrsmzqzgfuamrrtyob.supabase.co",
    key,
  };
}

function databaseUrl(): string | null {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function adminBackendAvailable(): boolean {
  return Boolean(serviceCredentials() || databaseUrl());
}

function serviceClient(): SupabaseClient {
  const credentials = serviceCredentials();
  if (!credentials) throw new AdminDataError("No se configuró SUPABASE_SERVICE_ROLE_KEY.");
  return createVanillaClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function withPostgres<T>(fn: (client: import("pg").Client) => Promise<T>): Promise<T> {
  const url = databaseUrl();
  if (!url) throw new AdminDataError("No se configuró DATABASE_URL.");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Ejecuta la operación por el primer backend disponible.
 * Devuelve también el backend que respondió, para diagnósticos.
 */
async function runElevated<T>(ops: {
  service: () => Promise<T>;
  postgres: () => Promise<T>;
}): Promise<{ value: T; backend: AdminBackend }> {
  let firstError: unknown = null;
  if (serviceCredentials()) {
    try {
      return { value: await ops.service(), backend: "service-role" };
    } catch (error) {
      firstError = error;
    }
  }
  if (databaseUrl()) {
    try {
      return { value: await ops.postgres(), backend: "postgres" };
    } catch (error) {
      firstError = firstError ?? error;
    }
  }
  const detail = firstError instanceof Error ? ` Detalle: ${firstError.message}` : "";
  throw new AdminDataError(
    "Configura SUPABASE_SERVICE_ROLE_KEY o DATABASE_URL para ejecutar tareas administrativas de correo y alertas." + detail,
  );
}

/* ─────────────────────────────────────────────────────────────
 * Correo saliente
 * ───────────────────────────────────────────────────────────── */

export interface EmailConfigSnapshot {
  settings: EmailSettingsDraft;
  password: string | null;
  backend: AdminBackend;
  migrationPending: boolean;
}

export async function readEmailConfig(): Promise<EmailConfigSnapshot> {
  const { value, backend } = await runElevated({
    service: async () => {
      const client = serviceClient();
      const [settingsResult, secretResult] = await Promise.all([
        client.from("email_settings").select("*").eq("id", true).maybeSingle(),
        client.from("email_secrets").select("smtp_password").eq("id", true).maybeSingle(),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (secretResult.error && secretResult.error.code !== "42P01") throw secretResult.error;
      return {
        row: settingsResult.data as Record<string, unknown> | null,
        password: (secretResult.data?.smtp_password as string | null) ?? null,
      };
    },
    postgres: async () => withPostgres(async client => {
      const settings = await client.query("SELECT * FROM public.email_settings WHERE id = TRUE LIMIT 1");
      let password: string | null = null;
      try {
        const secret = await client.query("SELECT smtp_password FROM public.email_secrets WHERE id = TRUE LIMIT 1");
        password = (secret.rows[0]?.smtp_password as string | null | undefined) ?? null;
      } catch {
        password = null;
      }
      return { row: (settings.rows[0] as Record<string, unknown>) ?? null, password };
    }),
  });
  return {
    settings: normalizeStoredEmailSettings(value.row),
    password: value.password,
    backend,
    migrationPending: !value.row,
  };
}

/** Indica si la contraseña de aplicación está guardada, sin exponerla. */
export async function readEmailPasswordPresence(): Promise<{ available: boolean; hasPassword: boolean }> {
  try {
    const { value } = await runElevated({
      service: async () => {
        const client = serviceClient();
        const { data, error } = await client.from("email_secrets").select("smtp_password").eq("id", true).maybeSingle();
        if (error) throw error;
        return (data?.smtp_password as string | null) ?? null;
      },
      postgres: async () => withPostgres(async client => {
        const result = await client.query("SELECT smtp_password FROM public.email_secrets WHERE id = TRUE LIMIT 1");
        return (result.rows[0]?.smtp_password as string | null) ?? null;
      }),
    });
    return { available: true, hasPassword: Boolean(value && value.trim().length > 0) };
  } catch {
    return { available: false, hasPassword: false };
  }
}

/** Guarda (o borra) la contraseña de aplicación SMTP. */
export async function writeEmailPassword(password: string | null): Promise<AdminBackend> {
  const { backend } = await runElevated({
    service: async () => {
      const client = serviceClient();
      const { error } = await client
        .from("email_secrets")
        .upsert(
          { id: true, smtp_password: password, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
      if (error) throw error;
    },
    postgres: async () => withPostgres(async client => {
      await client.query(
        `INSERT INTO public.email_secrets (id, smtp_password, updated_at)
         VALUES (TRUE, $1, NOW())
         ON CONFLICT (id) DO UPDATE SET smtp_password = EXCLUDED.smtp_password, updated_at = NOW()`,
        [password],
      );
    }),
  });
  return backend;
}

export interface EmailLogRow {
  alertIds: string[];
  toEmail: string;
  subject: string;
  kind: "test" | "alert_digest" | "weekly_summary" | "password_reset";
  status: "sent" | "failed";
  errorMessage?: string | null;
  providerMessageId?: string | null;
}

export async function appendEmailLogs(rows: EmailLogRow[]): Promise<void> {
  if (rows.length === 0) return;
  await runElevated({
    service: async () => {
      const client = serviceClient();
      const { error } = await client.from("email_log").insert(rows.map(row => ({
        alert_ids: row.alertIds,
        to_email: row.toEmail,
        subject: row.subject,
        kind: row.kind,
        status: row.status,
        error_message: row.errorMessage ?? null,
        provider_message_id: row.providerMessageId ?? null,
      })));
      if (error) throw error;
    },
    postgres: async () => withPostgres(async client => {
      for (const row of rows) {
        await client.query(
          `INSERT INTO public.email_log (alert_ids, to_email, subject, kind, status, error_message, provider_message_id)
           VALUES ($1::uuid[], $2, $3, $4, $5, $6, $7)`,
          [row.alertIds, row.toEmail, row.subject, row.kind, row.status, row.errorMessage ?? null, row.providerMessageId ?? null],
        );
      }
    }),
  });
}

/* ─────────────────────────────────────────────────────────────
 * Ejecución del motor de alertas
 * ───────────────────────────────────────────────────────────── */

export interface SweepSnapshot {
  tasks: TaskRecord[];
  submissions: SubmissionRecord[];
  people: PersonRecord[];
  courses: CourseRecord[];
  memberships: MembershipRecord[];
  parentLinks: ParentStudentLinkRecord[];
  alertRules: AlertRules;
  enabledTypes: Record<AlertType, boolean>;
  backend: AdminBackend;
}

export async function loadSweepSnapshot(): Promise<SweepSnapshot> {
  const { value, backend } = await runElevated({
    service: async () => {
      const client = serviceClient();
      const [tasks, submissions, people, courses, memberships, parentLinks, rules] = await Promise.all([
        client.from("tasks").select("id, title, task_type, due_date, course_id"),
        client.from("submissions").select("id, task_id, student_id, status, score, created_at"),
        client.from("profiles").select("id, full_name, email, role"),
        client.from("courses").select("id, name, section, teacher_id"),
        client.from("course_members").select("course_id, profile_id"),
        client.from("parent_children").select("parent_profile_id, student_profile_id"),
        client.from("notification_rules").select("rule_key, enabled, config"),
      ]);
      for (const result of [tasks, submissions, people, courses, memberships, parentLinks, rules]) {
        if (result.error) throw result.error;
      }
      return {
        tasks: (tasks.data || []) as TaskRecord[],
        submissions: (submissions.data || []) as SubmissionRecord[],
        people: (people.data || []) as PersonRecord[],
        courses: (courses.data || []) as CourseRecord[],
        memberships: (memberships.data || []) as MembershipRecord[],
        parentLinks: (parentLinks.data || []) as ParentStudentLinkRecord[],
        ruleRows: (rules.data || []) as { rule_key: string; enabled: boolean; config: Record<string, unknown> | null }[],
      };
    },
    postgres: async () => withPostgres(async client => {
      // Un solo cliente `pg`: las consultas se ejecutan en serie (pg no permite
      // consultas concurrentes sobre la misma conexión).
      const tasks = await client.query("SELECT id, title, task_type, due_date, course_id FROM public.tasks");
      const submissions = await client.query("SELECT id, task_id, student_id, status, score, created_at FROM public.submissions");
      const people = await client.query("SELECT id, full_name, email, role FROM public.profiles");
      const courses = await client.query("SELECT id, name, section, teacher_id FROM public.courses");
      const memberships = await client.query("SELECT course_id, profile_id FROM public.course_members");
      const parentLinks = await client.query("SELECT parent_profile_id, student_profile_id FROM public.parent_children");
      const rules = await client.query("SELECT rule_key, enabled, config FROM public.notification_rules");
      return {
        tasks: tasks.rows as TaskRecord[],
        submissions: submissions.rows.map((row: Record<string, unknown>) => ({ ...row, score: row.score === null ? null : Number(row.score) })) as SubmissionRecord[],
        people: people.rows as PersonRecord[],
        courses: courses.rows as CourseRecord[],
        memberships: memberships.rows as MembershipRecord[],
        parentLinks: parentLinks.rows as ParentStudentLinkRecord[],
        ruleRows: rules.rows as { rule_key: string; enabled: boolean; config: Record<string, unknown> | null }[],
      };
    }),
  });
  const { rules, enabledTypes } = mergeAlertRules(value.ruleRows);
  return {
    tasks: value.tasks,
    submissions: value.submissions,
    people: value.people,
    courses: value.courses,
    memberships: value.memberships,
    parentLinks: value.parentLinks,
    alertRules: rules,
    enabledTypes,
    backend,
  };
}

export interface NewAlertRow {
  alertType: AlertType;
  severity: string;
  title: string;
  message: string;
  studentId: string | null;
  taskId: string | null;
  courseId: string | null;
  metadata: Record<string, unknown>;
  dedupeKey: string;
}

export interface InsertedAlertRow {
  id: string;
  dedupe_key: string;
  alert_type: AlertType;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

/** Inserta solo las alertas nuevas (clave única `dedupe_key`). */
export async function writeSmartAlerts(rows: NewAlertRow[]): Promise<InsertedAlertRow[]> {
  if (rows.length === 0) return [];
  const { value } = await runElevated({
    service: async () => {
      const client = serviceClient();
      const { data, error } = await client
        .from("smart_alerts")
        .upsert(rows.map(row => ({
          alert_type: row.alertType,
          severity: row.severity,
          title: row.title,
          message: row.message,
          student_id: row.studentId,
          task_id: row.taskId,
          course_id: row.courseId,
          metadata: row.metadata,
          dedupe_key: row.dedupeKey,
        })), { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id, dedupe_key, alert_type, severity, title, message, metadata");
      if (error) throw error;
      return (data || []) as InsertedAlertRow[];
    },
    postgres: async () => withPostgres(async client => {
      const values: unknown[] = [];
      const tuples = rows.map((row, index) => {
        const base = index * 9;
        values.push(
          row.alertType, row.severity, row.title, row.message,
          row.studentId, row.taskId, row.courseId,
          JSON.stringify(row.metadata), row.dedupeKey,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}::jsonb, $${base + 9})`;
      });
      const result = await client.query(
        `INSERT INTO public.smart_alerts
           (alert_type, severity, title, message, student_id, task_id, course_id, metadata, dedupe_key)
         VALUES ${tuples.join(", ")}
         ON CONFLICT (dedupe_key) DO NOTHING
         RETURNING id, dedupe_key, alert_type, severity, title, message, metadata`,
        values,
      );
      return result.rows as InsertedAlertRow[];
    }),
  });
  return value;
}

/** Marca el resultado del correo: enviado o fallido. */
export async function finalizeAlertEmails(
  updates: { id: string; ok: boolean; sentAt?: string }[],
): Promise<void> {
  const delivered = updates.filter(u => u.ok).map(u => u.id);
  const failed = updates.filter(u => !u.ok).map(u => u.id);
  if (delivered.length === 0 && failed.length === 0) return;
  const sentAt = updates.find(u => u.sentAt)?.sentAt || new Date().toISOString();
  await runElevated({
    service: async () => {
      const client = serviceClient();
      if (delivered.length > 0) {
        const { error } = await client.from("smart_alerts")
          .update({ status: "sent", email_status: "sent", sent_at: sentAt, updated_at: sentAt })
          .in("id", delivered);
        if (error) throw error;
      }
      if (failed.length > 0) {
        const { error } = await client.from("smart_alerts")
          .update({ email_status: "failed", updated_at: sentAt })
          .in("id", failed);
        if (error) throw error;
      }
    },
    postgres: async () => withPostgres(async client => {
      if (delivered.length > 0) {
        await client.query(
          `UPDATE public.smart_alerts
             SET status = 'sent', email_status = 'sent', sent_at = $2, updated_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [delivered, sentAt],
        );
      }
      if (failed.length > 0) {
        await client.query(
          `UPDATE public.smart_alerts
             SET email_status = 'failed', updated_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [failed],
        );
      }
    }),
  });
}

/* ─────────────────────────────────────────────────────────────
 * Recuperación de contraseña (ítem 23 ampliado)
 * ───────────────────────────────────────────────────────────── */

export type RecoveryTokenResult =
  | { ok: true; hashedToken: string }
  | { ok: false; reason: "unavailable" | "not_found" | "error"; message?: string };

/**
 * Genera un token de recuperación con la API administrativa de Supabase.
 * Requiere `SUPABASE_SERVICE_ROLE_KEY`: GoTrue no permite emitir enlaces de
 * recuperación sin la clave de servicio. Si no está configurada, la ruta cae
 * al correo estándar de Supabase (respaldo).
 */
export async function generateRecoveryToken(email: string): Promise<RecoveryTokenResult> {
  const credentials = serviceCredentials();
  if (!credentials) return { ok: false, reason: "unavailable" };
  try {
    const client = createVanillaClient(credentials.url, credentials.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.admin.generateLink({ type: "recovery", email });
    if (error) {
      const notFound = /user not found|not found/i.test(error.message || "");
      return { ok: false, reason: notFound ? "not_found" : "error", message: error.message };
    }
    const hashedToken = data?.properties?.hashed_token;
    if (!hashedToken) {
      return { ok: false, reason: "error", message: "Supabase no devolvió el token de recuperación." };
    }
    return { ok: true, hashedToken };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "No se pudo generar el enlace de recuperación.",
    };
  }
}

export type RecoveryDelivery = "app_smtp" | "supabase_auth" | "skipped";

/** Registra una solicitud de recuperación para auditar y limitar el abuso. */
export async function recordPasswordResetRequest(input: {
  email: string;
  requesterHash: string | null;
  deliveredVia: RecoveryDelivery;
}): Promise<AdminBackend> {
  const { backend } = await runElevated({
    service: async () => {
      const client = serviceClient();
      const { error } = await client.from("password_reset_requests").insert({
        email: input.email,
        requester_hash: input.requesterHash,
        delivered_via: input.deliveredVia,
      });
      if (error) throw error;
    },
    postgres: async () => withPostgres(async client => {
      await client.query(
        `INSERT INTO public.password_reset_requests (email, requester_hash, delivered_via)
         VALUES ($1, $2, $3)`,
        [input.email, input.requesterHash, input.deliveredVia],
      );
    }),
  });
  return backend;
}

/** Cuenta las solicitudes recientes por correo y por solicitante (IP). */
export async function countRecentPasswordResetRequests(input: {
  email: string;
  requesterHash: string | null;
  windowMinutes: number;
}): Promise<{ byEmail: number; byRequester: number }> {
  const { value } = await runElevated({
    service: async () => {
      const client = serviceClient();
      const since = new Date(Date.now() - input.windowMinutes * 60_000).toISOString();
      const byEmail = await client
        .from("password_reset_requests")
        .select("id", { count: "exact", head: true })
        .eq("email", input.email)
        .gt("created_at", since);
      if (byEmail.error) throw byEmail.error;
      let byRequester = 0;
      if (input.requesterHash) {
        const result = await client
          .from("password_reset_requests")
          .select("id", { count: "exact", head: true })
          .eq("requester_hash", input.requesterHash)
          .gt("created_at", since);
        if (result.error) throw result.error;
        byRequester = result.count ?? 0;
      }
      return { byEmail: byEmail.count ?? 0, byRequester };
    },
    postgres: async () => withPostgres(async client => {
      // Un solo cliente `pg`: las consultas van en serie.
      const byEmail = await client.query(
        `SELECT count(*)::int AS total FROM public.password_reset_requests
         WHERE email = $1 AND created_at > NOW() - make_interval(mins => $2::int)`,
        [input.email, input.windowMinutes],
      );
      let byRequester = 0;
      if (input.requesterHash) {
        const result = await client.query(
          `SELECT count(*)::int AS total FROM public.password_reset_requests
           WHERE requester_hash = $1 AND created_at > NOW() - make_interval(mins => $2::int)`,
          [input.requesterHash, input.windowMinutes],
        );
        byRequester = Number(result.rows[0]?.total ?? 0);
      }
      return { byEmail: Number(byEmail.rows[0]?.total ?? 0), byRequester };
    }),
  });
  return value;
}
