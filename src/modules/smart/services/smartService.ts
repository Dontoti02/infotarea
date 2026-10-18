/**
 * Integración del componente inteligente con Supabase (ítem 22).
 *
 * Carga tareas, entregas, matrículas y alertas reales (sin datos ficticios),
 * aplica las reglas puras de `@/shared/utils/prioritization` y devuelve la
 * clasificación por prioridad, los resúmenes de entregas y las alertas.
 * El alcance respeta el rol: la dirección ve todo; el docente, sus asignaturas.
 */

import { createClient } from "@/lib/supabase/client";
import {
  buildDeliverySummary,
  buildSmartMetrics,
  classifyTasks,
  type CourseRecord,
  type MembershipRecord,
  type PersonRecord,
  type SubmissionRecord,
  type TaskRecord,
} from "@/shared/utils/prioritization";
import type { SmartOverview, SmartScope, StoredAlert } from "../types";

interface LoaderOptions {
  userId: string;
  role: "admin" | "teacher" | "student" | "parent";
  /** Inyectable en pruebas: cliente compatible con el cliente de navegador. */
  client?: ReturnType<typeof createClient>;
  now?: Date;
  alertLimit?: number;
}

const EMPTY_METRICS = {
  totalTasks: 0,
  critical: 0,
  high: 0,
  dueSoon: 0,
  overdue: 0,
  pendingReviews: 0,
  notSubmittedTotal: 0,
  atRisk: 0,
  averageScore: null,
};

export async function loadSmartOverview(options: LoaderOptions): Promise<SmartOverview> {
  const supabase = options.client ?? createClient();
  const now = options.now || new Date();
  const generatedAt = now.toISOString();

  const scope: SmartScope = options.role === "admin"
    ? { role: "admin", label: "Toda la institución", courseIds: [] }
    : { role: options.role, label: "Mis asignaturas", courseIds: [] };

  // 1. Asignaturas del alcance.
  let courses: CourseRecord[] = [];
  if (options.role === "admin") {
    const { data, error } = await supabase.from("courses").select("id, name, section, teacher_id");
    if (error) throw new Error(error.message);
    courses = (data || []) as CourseRecord[];
  } else if (options.role === "teacher") {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name, section, teacher_id")
      .eq("teacher_id", options.userId);
    if (error) throw new Error(error.message);
    courses = (data || []) as CourseRecord[];
  } else {
    const { data, error } = await supabase
      .from("course_members")
      .select("course_id, courses(id, name, section, teacher_id)")
      .eq("profile_id", options.userId);
    if (error) throw new Error(error.message);
    courses = (data || [])
      .map((row: { courses: CourseRecord | CourseRecord[] | null }) =>
        Array.isArray(row.courses) ? row.courses[0] : row.courses)
      .filter((course): course is CourseRecord => Boolean(course));
  }
  scope.courseIds = courses.map(course => course.id);

  const courseIds = scope.courseIds;
  const courseNames: Record<string, string> = Object.fromEntries(courses.map(course => [course.id, course.name]));

  if (courseIds.length === 0) {
    const alerts = await loadRecentAlerts(supabase, options.alertLimit ?? 12, options.role, options.userId);
    return {
      scope,
      generatedAt,
      metrics: { ...EMPTY_METRICS },
      classified: [],
      summaries: [],
      alerts,
      courseNames,
    };
  }

  // 2. Datos académicos del alcance.
  const { data: taskRows, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, task_type, due_date, course_id")
    .in("course_id", courseIds);
  if (taskError) throw new Error(taskError.message);
  const tasks = (taskRows || []) as TaskRecord[];
  const taskIds = tasks.map(task => task.id);

  const { data: membershipRows, error: membershipError } = await supabase
    .from("course_members")
    .select("course_id, profile_id")
    .in("course_id", courseIds);
  if (membershipError) throw new Error(membershipError.message);
  const memberships = (membershipRows || []) as MembershipRecord[];

  let submissions: SubmissionRecord[] = [];
  const { data: submissionRows, error: submissionError } = await supabase
    .from("submissions")
    .select("id, task_id, student_id, status, score, created_at")
    .in("task_id", taskIds.length > 0 ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
  if (submissionError) throw new Error(submissionError.message);
  submissions = (submissionRows || []) as SubmissionRecord[];

  // 3. Estudiantes implicados (matriculados en las asignaturas del alcance).
  const studentIds = [...new Set(memberships.map(membership => membership.profile_id))];
  let students: PersonRecord[] = [];
  if (studentIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("id", studentIds)
      .eq("role", "student");
    if (profileError) throw new Error(profileError.message);
    students = (profileRows || []) as PersonRecord[];
  }

  // 4. Reglas puras del componente inteligente.
  const classified = classifyTasks({ tasks, submissions, courses }, now);
  const summaries = buildDeliverySummary({ students, tasks, submissions, memberships }, now)
    .sort((a, b) => {
      const weight = { en_riesgo: 0, observacion: 1, sin_actividad: 2, al_dia: 3 };
      return weight[a.riskLevel] - weight[b.riskLevel];
    });
  const metrics = buildSmartMetrics(classified, summaries, now);
  const alerts = await loadRecentAlerts(supabase, options.alertLimit ?? 12, options.role, options.userId);

  return { scope, generatedAt, metrics, classified, summaries, alerts, courseNames };
}

export interface StudentAlertsOptions {
  userId: string;
  /** Inyectable en pruebas: cliente compatible con el cliente de navegador. */
  client?: ReturnType<typeof createClient>;
  limit?: number;
}

/** Máximo de avisos personales que ve el estudiante en su tablero. */
export const STUDENT_ALERT_LIMIT = 5;

/**
 * Avisos dirigidos al propio estudiante (bajo rendimiento y similares).
 *
 * La consulta queda protegida por la política de RLS «Estudiantes ven sus
 * propias alertas»: aunque el filtro por `student_id` se repite aquí, la base
 * solo devuelve las filas del estudiante autenticado. Si la migración aún no
 * está aplicada, la interfaz sigue funcionando con una lista vacía.
 */
export async function loadStudentAlerts(options: StudentAlertsOptions): Promise<StoredAlert[]> {
  const supabase = options.client ?? createClient();
  const { data, error } = await supabase
    .from("smart_alerts")
    .select("id, alert_type, severity, title, message, student_id, task_id, course_id, metadata, dedupe_key, status, email_status, sent_at, created_at")
    .eq("student_id", options.userId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? STUDENT_ALERT_LIMIT);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(error.message);
  }
  return (data || []) as StoredAlert[];
}

export interface ChildAlertsOptions {
  /** Perfil del hijo que la familia está viendo en su panel. */
  studentId: string;
  /** Inyectable en pruebas: cliente compatible con el cliente de navegador. */
  client?: ReturnType<typeof createClient>;
  limit?: number;
}

/** Máximo de avisos de un hijo que ve la familia en su panel. */
export const PARENT_ALERT_LIMIT = 5;

/**
 * Avisos de un hijo para el panel familiar (bajo rendimiento y similares).
 *
 * La consulta queda protegida por la política de RLS «Padres ven las alertas
 * de sus hijos»: aunque aquí se filtre por el `student_id` del hijo activo,
 * la base solo devuelve filas si el usuario autenticado es su padre/madre
 * vinculado. Si la migración aún no está aplicada, la interfaz sigue
 * funcionando con una lista vacía.
 */
export async function loadChildAlerts(options: ChildAlertsOptions): Promise<StoredAlert[]> {
  const supabase = options.client ?? createClient();
  const { data, error } = await supabase
    .from("smart_alerts")
    .select("id, alert_type, severity, title, message, student_id, task_id, course_id, metadata, dedupe_key, status, email_status, sent_at, created_at")
    .eq("student_id", options.studentId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? PARENT_ALERT_LIMIT);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(error.message);
  }
  return (data || []) as StoredAlert[];
}

async function loadRecentAlerts(
  supabase: ReturnType<typeof createClient>,
  limit: number,
  role: LoaderOptions["role"],
  userId: string,
): Promise<StoredAlert[]> {
  let query = supabase
    .from("smart_alerts")
    .select("id, alert_type, severity, title, message, student_id, task_id, course_id, metadata, dedupe_key, status, email_status, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (role === "student" || role === "parent") query = query.eq("student_id", userId);
  const { data, error } = await query;
  if (error) {
    // La migración puede no estar aplicada todavía: el panel sigue funcionando
    // sin alertas en lugar de mostrar resultados ficticios.
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(error.message);
  }
  return (data || []) as StoredAlert[];
}
