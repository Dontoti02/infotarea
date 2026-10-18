/**
 * Iteración Nº 4 — Cuarta entrega incremental
 * InfoTarea · Priorización de tareas, generación de avisos y alertas inteligentes
 *
 * Reglas de negocio puras (sin Supabase ni React) para:
 *   21. Priorización de tareas (score, nivel y motivos) y generación de avisos.
 *   22. Clasificación de tareas y resúmenes de entregas del componente inteligente.
 *   23. Reglas de alertas del seguimiento académico y validación del correo saliente.
 *
 * Todo el módulo es determinista: recibe `now` y su configuración por parámetro,
 * de modo que pueda probarse con TDD sin tocar la base de datos ni el correo.
 */

export type TaskType = "homework" | "forum" | "exam";
export type SubmissionState = "not_submitted" | "pending" | "reviewed";
export type PriorityLevel = "critica" | "alta" | "media" | "baja";
export type RiskLevel = "en_riesgo" | "observacion" | "al_dia" | "sin_actividad";
export type AlertType =
  | "task_due_soon"
  | "task_overdue"
  | "submission_pending_review"
  | "student_at_risk"
  | "weekly_summary";
export type AlertSeverity = "critica" | "alta" | "media" | "informativa";
export type EmailSecurity = "tls" | "ssl" | "none";

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  en_riesgo: "En riesgo",
  observacion: "En observación",
  al_dia: "Al día",
  sin_actividad: "Sin actividad",
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  informativa: "Informativa",
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  task_due_soon: "Tarea próxima a vencer",
  task_overdue: "Tarea vencida sin entrega",
  submission_pending_review: "Entregas por revisar",
  student_at_risk: "Estudiante en riesgo",
  weekly_summary: "Resumen semanal",
};

export const ALERT_CONFIG_DEFAULTS: Record<AlertType, boolean> = {
  task_due_soon: true,
  task_overdue: true,
  submission_pending_review: true,
  student_at_risk: true,
  weekly_summary: true,
};

/**
 * Título con el que el propio estudiante ve un aviso dentro de la plataforma.
 * El motor guarda títulos en tercera persona («Estudiante en riesgo: …») para
 * docentes y dirección; al alumno se le presenta en segunda persona.
 */
export function studentAlertTitle(alertType: AlertType, storedTitle: string): string {
  if (alertType === "student_at_risk") return "Tu rendimiento requiere atención";
  return storedTitle;
}

/* ─────────────────────────────────────────────────────────────
 * Estructuras de datos compartidas
 * ───────────────────────────────────────────────────────────── */

export interface TaskRecord {
  id: string;
  title: string;
  task_type: string;
  due_date: string | null;
  course_id: string;
}

export interface SubmissionRecord {
  id: string;
  task_id: string;
  student_id: string;
  status: string;
  score: number | null;
  created_at?: string | null;
}

export interface PersonRecord {
  id: string;
  full_name: string;
  email?: string | null;
  role: string;
}

export interface CourseRecord {
  id: string;
  name: string;
  section?: string | null;
  teacher_id?: string | null;
}

export interface MembershipRecord {
  course_id: string;
  profile_id: string;
}

/** Vínculo familiar (tabla `parent_children`): padre/madre o apoderado ↔ estudiante. */
export interface ParentStudentLinkRecord {
  parent_profile_id: string;
  student_profile_id: string;
}

/* ─────────────────────────────────────────────────────────────
 * 21. Reglas de priorización
 * ───────────────────────────────────────────────────────────── */

export interface PriorityRules {
  /** Horas para considerar una tarea "próxima a vencer" (aviso preventivo). */
  dueSoonHours: number;
  /** Horas para la ventana urgente (aviso inmediato). */
  urgentHours: number;
  /** Peso añadido cuando la fecha límite ya pasó. */
  overdueWeight: number;
  /** Pesos por cercanía del vencimiento. */
  urgencyWeights: { urgent: number; soon: number; week: number; far: number };
  /** Peso base según el tipo de actividad. */
  typeWeights: Record<TaskType, number>;
  /** Ajuste según el estado de entrega agregado de la tarea. */
  submissionWeights: Record<SubmissionState, number>;
  /** Umbrales mínimos por nivel (el resto es "baja"). */
  thresholds: { critica: number; alta: number; media: number };
}

export const DEFAULT_PRIORITY_RULES: PriorityRules = {
  dueSoonHours: 48,
  urgentHours: 24,
  overdueWeight: 40,
  urgencyWeights: { urgent: 30, soon: 20, week: 10, far: 5 },
  typeWeights: { exam: 30, homework: 20, forum: 10 },
  submissionWeights: { not_submitted: 15, pending: 5, reviewed: -10 },
  thresholds: { critica: 70, alta: 50, media: 30 },
};

export interface ClassifiedTask {
  taskId: string;
  title: string;
  taskType: TaskType;
  courseId: string;
  courseName: string | null;
  dueDate: string | null;
  hoursToDue: number | null;
  isOverdue: boolean;
  submissionState: SubmissionState;
  submissions: number;
  pendingReviews: number;
  score: number;
  level: PriorityLevel;
  reasons: string[];
}

export function hoursUntilDue(dueDate: string | null | undefined, now: Date): number | null {
  if (!dueDate) return null;
  const time = Date.parse(dueDate);
  if (!Number.isFinite(time)) return null;
  return (time - now.getTime()) / 36e5;
}

function normalizeTaskType(value: string): TaskType {
  return value === "exam" || value === "forum" ? value : "homework";
}

export function formatHoursUntilDue(hours: number | null): string {
  if (hours === null) return "Sin fecha límite";
  const abs = Math.abs(hours);
  if (abs < 1) return hours < 0 ? "Venció hace menos de 1 h" : "Vence en menos de 1 h";
  if (abs < 48) {
    const value = Math.round(abs);
    return hours < 0 ? `Venció hace ${value} h` : `Vence en ${value} h`;
  }
  const days = Math.round(abs / 24);
  return hours < 0 ? `Venció hace ${days} día${days !== 1 ? "s" : ""}` : `Vence en ${days} día${days !== 1 ? "s" : ""}`;
}

export function priorityLevelFor(score: number, rules: PriorityRules = DEFAULT_PRIORITY_RULES): PriorityLevel {
  if (score >= rules.thresholds.critica) return "critica";
  if (score >= rules.thresholds.alta) return "alta";
  if (score >= rules.thresholds.media) return "media";
  return "baja";
}

/** Estado de entrega agregado de una tarea desde la perspectiva del revisor. */
export function aggregateSubmissionState(submissions: { status: string }[]): SubmissionState {
  if (submissions.length === 0) return "not_submitted";
  return submissions.some(s => s.status !== "reviewed") ? "pending" : "reviewed";
}

export function classifyTask(
  task: TaskRecord,
  submissions: SubmissionRecord[],
  now: Date = new Date(),
  rules: PriorityRules = DEFAULT_PRIORITY_RULES,
  courses: CourseRecord[] = [],
): ClassifiedTask {
  const taskType = normalizeTaskType(task.task_type);
  const hoursToDue = hoursUntilDue(task.due_date, now);
  const isOverdue = hoursToDue !== null && hoursToDue < 0;
  const submissionState = aggregateSubmissionState(submissions);
  const reasons: string[] = [];

  let score = rules.typeWeights[taskType] ?? rules.typeWeights.homework;
  reasons.push(taskType === "exam" ? "Examen" : taskType === "forum" ? "Foro" : "Tarea");

  if (hoursToDue !== null) {
    if (isOverdue) {
      score += rules.overdueWeight;
      reasons.push(formatHoursUntilDue(hoursToDue));
    } else if (hoursToDue <= rules.urgentHours) {
      score += rules.urgencyWeights.urgent;
      reasons.push(formatHoursUntilDue(hoursToDue));
    } else if (hoursToDue <= rules.dueSoonHours) {
      score += rules.urgencyWeights.soon;
      reasons.push(formatHoursUntilDue(hoursToDue));
    } else if (hoursToDue <= rules.dueSoonHours * 3.5) {
      score += rules.urgencyWeights.week;
      reasons.push("Vence esta semana");
    } else {
      score += rules.urgencyWeights.far;
    }
  }

  score += rules.submissionWeights[submissionState];
  if (submissionState === "not_submitted") reasons.push("Sin entregas registradas");
  else if (submissionState === "pending") {
    const pendingCount = submissions.filter(s => s.status !== "reviewed").length;
    reasons.push(pendingCount === 1 ? "1 entrega por revisar" : `${pendingCount} entregas por revisar`);
  } else reasons.push("Entregas revisadas");

  const course = courses.find(c => c.id === task.course_id) || null;
  return {
    taskId: task.id,
    title: task.title,
    taskType,
    courseId: task.course_id,
    courseName: course?.name || null,
    dueDate: task.due_date,
    hoursToDue,
    isOverdue,
    submissionState,
    submissions: submissions.length,
    pendingReviews: submissions.filter(s => s.status !== "reviewed").length,
    score,
    level: priorityLevelFor(score, rules),
    reasons,
  };
}

export function classifyTasks(
  input: { tasks: TaskRecord[]; submissions: SubmissionRecord[]; courses?: CourseRecord[] },
  now: Date = new Date(),
  rules: PriorityRules = DEFAULT_PRIORITY_RULES,
): ClassifiedTask[] {
  return input.tasks
    .map(task => classifyTask(
      task,
      input.submissions.filter(s => s.task_id === task.id),
      now,
      rules,
      input.courses || [],
    ))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.hoursToDue === null) return 1;
      if (b.hoursToDue === null) return -1;
      return a.hoursToDue - b.hoursToDue;
    });
}

/* ─────────────────────────────────────────────────────────────
 * 22. Resúmenes de entregas y métricas del componente inteligente
 * ───────────────────────────────────────────────────────────── */

export interface StudentDeliverySummary {
  studentId: string;
  fullName: string;
  email: string | null;
  courseIds: string[];
  assignedTasks: number;
  submitted: number;
  pendingReview: number;
  notSubmitted: number;
  overdue: number;
  averageScore: number | null;
  progress: number;
  riskLevel: RiskLevel;
}

export const RISK_THRESHOLDS = { atRisk: 5, observation: 7, overdueForRisk: 2 };

export function buildDeliverySummary(
  input: {
    students: PersonRecord[];
    tasks: TaskRecord[];
    submissions: SubmissionRecord[];
    memberships: MembershipRecord[];
  },
  now: Date = new Date(),
): StudentDeliverySummary[] {
  return input.students.map(student => {
    const courseIds = [...new Set(
      input.memberships.filter(m => m.profile_id === student.id).map(m => m.course_id),
    )];
    const assigned = input.tasks.filter(t => courseIds.includes(t.course_id));
    const studentSubmissions = input.submissions.filter(s => s.student_id === student.id);
    const submitted = assigned.filter(t => studentSubmissions.some(s => s.task_id === t.id)).length;
    const pendingReview = assigned.filter(task => {
      const submission = studentSubmissions.find(s => s.task_id === task.id);
      return submission !== undefined && submission.status !== "reviewed";
    }).length;
    const overdue = assigned.filter(task => {
      const hours = hoursUntilDue(task.due_date, now);
      return hours !== null && hours < 0 && !studentSubmissions.some(s => s.task_id === task.id);
    }).length;
    const graded = studentSubmissions.filter(s => s.status === "reviewed" && typeof s.score === "number");
    const averageScore = graded.length > 0
      ? Number((graded.reduce((sum, s) => sum + Number(s.score), 0) / graded.length).toFixed(1))
      : null;

    let riskLevel: RiskLevel = "al_dia";
    if (submitted === 0) riskLevel = "sin_actividad";
    else if ((averageScore !== null && averageScore < RISK_THRESHOLDS.atRisk) || overdue >= RISK_THRESHOLDS.overdueForRisk) {
      riskLevel = "en_riesgo";
    } else if ((averageScore !== null && averageScore < RISK_THRESHOLDS.observation) || overdue >= 1) {
      riskLevel = "observacion";
    }

    return {
      studentId: student.id,
      fullName: student.full_name,
      email: student.email ?? null,
      courseIds,
      assignedTasks: assigned.length,
      submitted,
      pendingReview,
      notSubmitted: Math.max(0, assigned.length - submitted),
      overdue,
      averageScore,
      progress: assigned.length > 0 ? Number((submitted / assigned.length).toFixed(3)) : 0,
      riskLevel,
    };
  });
}

export interface SmartMetrics {
  totalTasks: number;
  critical: number;
  high: number;
  dueSoon: number;
  overdue: number;
  pendingReviews: number;
  notSubmittedTotal: number;
  atRisk: number;
  averageScore: number | null;
}

export function buildSmartMetrics(
  classified: ClassifiedTask[],
  summaries: StudentDeliverySummary[],
  now: Date = new Date(),
  rules: PriorityRules = DEFAULT_PRIORITY_RULES,
): SmartMetrics {
  const scored = summaries.filter(s => s.averageScore !== null);
  return {
    totalTasks: classified.length,
    critical: classified.filter(t => t.level === "critica").length,
    high: classified.filter(t => t.level === "alta").length,
    dueSoon: classified.filter(t => {
      const hours = hoursUntilDue(t.dueDate, now);
      return hours !== null && hours >= 0 && hours <= rules.dueSoonHours;
    }).length,
    overdue: summaries.reduce((sum, s) => sum + s.overdue, 0),
    pendingReviews: summaries.reduce((sum, s) => sum + s.pendingReview, 0),
    notSubmittedTotal: summaries.reduce((sum, s) => sum + s.notSubmitted, 0),
    atRisk: summaries.filter(s => s.riskLevel === "en_riesgo").length,
    averageScore: scored.length > 0
      ? Number((scored.reduce((sum, s) => sum + Number(s.averageScore), 0) / scored.length).toFixed(1))
      : null,
  };
}

/* ─────────────────────────────────────────────────────────────
 * 23. Reglas de generación de avisos y alertas de seguimiento
 * ───────────────────────────────────────────────────────────── */

export interface AlertRules {
  /** Horas de anticipación para el aviso "tarea próxima a vencer". */
  dueSoonHours: number;
  /** Antigüedad mínima de una entrega sin calificar para avisar al docente. */
  pendingReviewHours: number;
  /** Promedio por debajo del cual un estudiante se considera en riesgo. */
  atRiskAverage: number;
  /** Cantidad de tareas vencidas sin entrega que activa el riesgo. */
  overdueLimitForRisk: number;
}

export const DEFAULT_ALERT_RULES: AlertRules = {
  dueSoonHours: 48,
  pendingReviewHours: 48,
  atRiskAverage: RISK_THRESHOLDS.atRisk,
  overdueLimitForRisk: RISK_THRESHOLDS.overdueForRisk,
};

export interface AlertAudience {
  role: "admin" | "teacher" | "student" | "parent";
  profileId: string;
  email: string | null;
}

export interface AlertCandidate {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  studentId: string | null;
  taskId: string | null;
  courseId: string | null;
  dedupeKey: string;
  metadata: Record<string, unknown>;
  audience: AlertAudience[];
}

export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Clave ISO de semana (AAAA-Www) usada para avisos semanales. */
export function weekKey(date: Date = new Date()): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 36e5));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function buildAlertCandidates(
  input: {
    tasks: TaskRecord[];
    submissions: SubmissionRecord[];
    people: PersonRecord[];
    courses: CourseRecord[];
    memberships: MembershipRecord[];
    parentLinks?: ParentStudentLinkRecord[];
  },
  now: Date = new Date(),
  alertRules: AlertRules = DEFAULT_ALERT_RULES,
  priorityRules: PriorityRules = DEFAULT_PRIORITY_RULES,
): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  const day = dayKey(now);
  const week = weekKey(now);

  const students = input.people.filter(p => p.role === "student");
  const teachers = input.people.filter(p => p.role === "teacher");
  const admins = input.people.filter(p => p.role === "admin");
  const parents = input.people.filter(p => p.role === "parent");
  const studentById = new Map(students.map(s => [s.id, s]));
  const teacherById = new Map(teachers.map(t => [t.id, t]));
  const courseById = new Map(input.courses.map(c => [c.id, c]));

  const audienceOf = (ids: string[], roles: PersonRecord["role"][]): AlertAudience[] => {
    const seen = new Set<string>();
    const result: AlertAudience[] = [];
    for (const person of [...students, ...teachers, ...admins, ...parents]) {
      if (!ids.includes(person.id) || !roles.includes(person.role) || seen.has(person.id)) continue;
      seen.add(person.id);
      result.push({ role: person.role as AlertAudience["role"], profileId: person.id, email: person.email ?? null });
    }
    return result;
  };
  const adminIds = admins.map(a => a.id);

  // Avisos por tarea: próximas a vencer y vencidas sin entrega.
  for (const task of input.tasks) {
    const hours = hoursUntilDue(task.due_date, now);
    if (hours === null) continue;
    const course = courseById.get(task.course_id);
    const courseMemberIds = input.memberships
      .filter(m => m.course_id === task.course_id && studentById.has(m.profile_id))
      .map(m => m.profile_id);
    const taskSubmissions = input.submissions.filter(s => s.task_id === task.id);
    const pendingStudentIds = courseMemberIds.filter(id => !taskSubmissions.some(s => s.student_id === id));
    if (pendingStudentIds.length === 0) continue;
    const pendingNames = pendingStudentIds.map(id => studentById.get(id)?.full_name || "Estudiante");
    const teacherIds = course?.teacher_id ? [course.teacher_id] : [];

    if (hours < 0) {
      candidates.push({
        alertType: "task_overdue",
        severity: "critica",
        title: `Tarea vencida: ${task.title}`,
        message: `${pendingStudentIds.length} estudiante${pendingStudentIds.length !== 1 ? "s" : ""} no entregaron la actividad de ${course?.name || "la asignatura"} (${formatHoursUntilDue(hours)}).`,
        studentId: null,
        taskId: task.id,
        courseId: task.course_id,
        dedupeKey: `overdue:${task.id}`,
        metadata: {
          studentIds: pendingStudentIds,
          studentNames: pendingNames,
          courseName: course?.name || null,
          dueDate: task.due_date,
        },
        audience: audienceOf([...pendingStudentIds, ...teacherIds, ...adminIds], ["student", "teacher", "admin"]),
      });
    } else if (hours <= alertRules.dueSoonHours && hours > 0) {
      candidates.push({
        alertType: "task_due_soon",
        severity: hours <= priorityRules.urgentHours ? "critica" : "alta",
        title: `Tarea por vencer: ${task.title}`,
        message: `${formatHoursUntilDue(hours)} y ${pendingStudentIds.length} estudiante${pendingStudentIds.length !== 1 ? "s" : ""} aún no entregan.`,
        studentId: null,
        taskId: task.id,
        courseId: task.course_id,
        dedupeKey: `due_soon:${task.id}:${day}`,
        metadata: {
          studentIds: pendingStudentIds,
          studentNames: pendingNames,
          courseName: course?.name || null,
          dueDate: task.due_date,
          hoursToDue: Math.round(hours),
        },
        audience: audienceOf([...pendingStudentIds, ...teacherIds, ...adminIds], ["student", "teacher", "admin"]),
      });
    }
  }

  // Avisos por entregas sin calificar agrupadas por asignatura.
  const staleReviewByCourse = new Map<string, SubmissionRecord[]>();
  for (const submission of input.submissions) {
    if (submission.status === "reviewed") continue;
    const created = submission.created_at ? Date.parse(submission.created_at) : NaN;
    if (!Number.isFinite(created)) continue;
    const ageHours = (now.getTime() - created) / 36e5;
    if (ageHours < alertRules.pendingReviewHours) continue;
    const task = input.tasks.find(t => t.id === submission.task_id);
    if (!task) continue;
    const list = staleReviewByCourse.get(task.course_id) || [];
    list.push(submission);
    staleReviewByCourse.set(task.course_id, list);
  }
  for (const [courseId, submissions] of staleReviewByCourse) {
    const course = courseById.get(courseId);
    const teacherIds = course?.teacher_id ? [course.teacher_id] : [];
    candidates.push({
      alertType: "submission_pending_review",
      severity: "media",
      title: `Entregas por revisar en ${course?.name || "asignatura"}`,
      message: `${submissions.length} entrega${submissions.length !== 1 ? "s" : ""} llevan más de ${alertRules.pendingReviewHours} h sin calificar.`,
      studentId: null,
      taskId: null,
      courseId,
      dedupeKey: `pending_review:${courseId}:${day}`,
      metadata: { submissionIds: submissions.map(s => s.id), courseName: course?.name || null },
      audience: audienceOf([...teacherIds, ...adminIds], ["teacher", "admin"]),
    });
  }

  // Avisos por estudiantes en riesgo (semanal para no saturar; el correo va solo a docentes y padres).
  const summaries = buildDeliverySummary(
    { students, tasks: input.tasks, submissions: input.submissions, memberships: input.memberships },
    now,
  );
  for (const summary of summaries) {
    const atRisk = summary.riskLevel === "en_riesgo"
      || (summary.averageScore !== null && summary.averageScore < alertRules.atRiskAverage)
      || summary.overdue >= alertRules.overdueLimitForRisk;
    if (!atRisk || summary.submitted === 0) continue;
    const student = studentById.get(summary.studentId);
    if (!student) continue;
    const teacherIds = input.courses
      .filter(c => summary.courseIds.includes(c.id) && c.teacher_id && teacherById.has(c.teacher_id))
      .map(c => c.teacher_id as string);
    // El correo de bajo rendimiento va solo a los adultos responsables: los
    // docentes del aula y los padres vinculados. El estudiante no recibe correo
    // (su aviso queda dentro del sistema) y la dirección tampoco (lo ve en el
    // panel y en su resumen semanal).
    const parentIds = (input.parentLinks ?? [])
      .filter(link => link.student_profile_id === summary.studentId)
      .map(link => link.parent_profile_id);
    candidates.push({
      alertType: "student_at_risk",
      severity: "alta",
      title: `Estudiante en riesgo: ${summary.fullName}`,
      message: `Promedio ${summary.averageScore ?? "sin notas"} · ${summary.overdue} vencida${summary.overdue !== 1 ? "s" : ""} · ${summary.notSubmitted} sin entregar. Requiere seguimiento.`,
      studentId: summary.studentId,
      taskId: null,
      courseId: null,
      dedupeKey: `at_risk:${summary.studentId}:${week}`,
      metadata: {
        averageScore: summary.averageScore,
        overdue: summary.overdue,
        notSubmitted: summary.notSubmitted,
        progress: summary.progress,
      },
      audience: audienceOf([...teacherIds, ...parentIds], ["teacher", "parent"]),
    });
  }

  // Resumen semanal para la dirección.
  if (admins.length > 0) {
    const metrics = buildSmartMetrics(classifyTasks(input, now, priorityRules), summaries, now, priorityRules);
    candidates.push({
      alertType: "weekly_summary",
      severity: "informativa",
      title: `Resumen semanal de seguimiento (${week})`,
      message: `${metrics.pendingReviews} entregas por revisar · ${metrics.overdue} vencidas · ${metrics.atRisk} estudiantes en riesgo · promedio general ${metrics.averageScore ?? "sin datos"}.`,
      studentId: null,
      taskId: null,
      courseId: null,
      dedupeKey: `weekly_summary:${week}`,
      metadata: { ...metrics, week },
      audience: audienceOf(adminIds, ["admin"]),
    });
  }

  const severityOrder: Record<AlertSeverity, number> = { critica: 0, alta: 1, media: 2, informativa: 3 };
  return candidates.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export interface EmailDigest {
  profileId: string | null;
  role: AlertAudience["role"];
  to: string;
  subject: string;
  alerts: Pick<AlertCandidate, "alertType" | "severity" | "title" | "message" | "dedupeKey">[];
}

export function buildEmailDigests(candidates: AlertCandidate[]): EmailDigest[] {
  const byRecipient = new Map<string, EmailDigest>();
  for (const candidate of candidates) {
    for (const person of candidate.audience) {
      if (!person.email || !person.email.includes("@")) continue;
      const existing = byRecipient.get(person.email) || {
        profileId: person.profileId,
        role: person.role,
        to: person.email,
        subject: "",
        alerts: [],
      };
      if (!existing.alerts.some(a => a.dedupeKey === candidate.dedupeKey)) {
        existing.alerts.push({
          alertType: candidate.alertType,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          dedupeKey: candidate.dedupeKey,
        });
      }
      byRecipient.set(person.email, existing);
    }
  }
  const severityOrder: Record<AlertSeverity, number> = { critica: 0, alta: 1, media: 2, informativa: 3 };
  return [...byRecipient.values()].map(digest => {
    digest.alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    digest.subject = digest.alerts.length === 1
      ? `InfoTarea · ${digest.alerts[0].title}`
      : `InfoTarea · ${digest.alerts.length} alertas de seguimiento académico`;
    return digest;
  });
}

/* ─────────────────────────────────────────────────────────────
 * 23. Validación y transporte del correo saliente (SMTP)
 * ───────────────────────────────────────────────────────────── */

export interface EmailSettingsDraft {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_security: EmailSecurity;
  smtp_user: string | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  alert_config: Record<AlertType, boolean>;
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isGmailHost(host: string): boolean {
  return /(^|\.)gmail\.com$/i.test(host.trim()) || /(^|\.)googlemail\.com$/i.test(host.trim());
}

export interface EmailSettingsValidation {
  valid: boolean;
  errors: string[];
  settings?: EmailSettingsDraft;
  passwordAction: "keep" | "set" | "clear";
  password?: string;
}

export function validateEmailSettingsInput(input: unknown): EmailSettingsValidation {
  const errors: string[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const host = typeof body.smtp_host === "string" ? body.smtp_host.trim().toLowerCase() : "";
  if (!host) errors.push("El servidor SMTP es obligatorio.");
  else if (host.length > 253 || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) {
    errors.push("El servidor SMTP no es un nombre de host válido.");
  }

  const port = typeof body.smtp_port === "number" ? body.smtp_port : Number.parseInt(String(body.smtp_port ?? ""), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("El puerto SMTP debe ser un número entre 1 y 65535.");
  }

  const security = body.smtp_security;
  if (security !== "tls" && security !== "ssl" && security !== "none") {
    errors.push("La seguridad debe ser TLS, SSL o sin cifrado.");
  }

  const user = typeof body.smtp_user === "string" ? body.smtp_user.trim() : "";
  if (user && !isValidEmail(user)) {
    errors.push("El usuario SMTP debe ser una dirección de correo válida.");
  }

  const fromEmail = typeof body.from_email === "string" ? body.from_email.trim() : "";
  const enabled = body.enabled === true;
  if (fromEmail && !isValidEmail(fromEmail)) {
    errors.push("El correo remitente no es válido.");
  } else if (enabled && !fromEmail) {
    errors.push("Activa el envío solo si indicas un correo remitente válido.");
  }

  const fromName = typeof body.from_name === "string" ? body.from_name.trim() : "";
  if (fromName.length > 120) errors.push("El nombre del remitente no debe superar 120 caracteres.");

  const replyTo = typeof body.reply_to === "string" ? body.reply_to.trim() : "";
  if (replyTo && !isValidEmail(replyTo)) errors.push("El correo de respuesta no es válido.");

  const rawConfig = (body.alert_config && typeof body.alert_config === "object" ? body.alert_config : {}) as Record<string, unknown>;
  const alertConfig = { ...ALERT_CONFIG_DEFAULTS };
  for (const key of Object.keys(alertConfig) as AlertType[]) {
    if (typeof rawConfig[key] === "boolean") alertConfig[key] = rawConfig[key] as boolean;
  }

  if (host && isGmailHost(host) && security === "tls" && port !== 587) {
    errors.push("Con Gmail usa el puerto 587 para TLS (o el 465 con SSL).");
  }
  if (host && isGmailHost(host) && security === "ssl" && port !== 465) {
    errors.push("Con Gmail usa el puerto 465 para SSL (o el 587 con TLS).");
  }

  let passwordAction: "keep" | "set" | "clear" = "keep";
  let password: string | undefined;
  if (body.clear_password === true) {
    passwordAction = "clear";
  } else if (typeof body.smtp_password === "string" && body.smtp_password.trim().length > 0) {
    const clean = body.smtp_password.replace(/\s+/g, "");
    if (clean.length < 8) errors.push("La contraseña de aplicación debe tener al menos 8 caracteres.");
    else {
      passwordAction = "set";
      password = clean;
    }
  }

  if (errors.length > 0) return { valid: false, errors, passwordAction };
  return {
    valid: true,
    errors: [],
    passwordAction,
    password,
    settings: {
      enabled,
      smtp_host: host,
      smtp_port: port,
      smtp_security: security as EmailSecurity,
      smtp_user: user || null,
      from_email: fromEmail || null,
      from_name: fromName || null,
      reply_to: replyTo || null,
      alert_config: alertConfig,
    },
  };
}

export function smtpTransportOptions(
  settings: Pick<EmailSettingsDraft, "smtp_host" | "smtp_port" | "smtp_security" | "smtp_user">,
  password: string | null,
): {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string } | null;
  tls: { minVersion: string };
} {
  const secure = settings.smtp_security === "ssl" || (settings.smtp_port === 465 && settings.smtp_security !== "none");
  return {
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure,
    requireTLS: settings.smtp_security === "tls" && !secure,
    auth: settings.smtp_user && password ? { user: settings.smtp_user, pass: password } : null,
    tls: { minVersion: "TLSv1.2" },
  };
}

export function isSmtpConfigured(
  settings: Pick<EmailSettingsDraft, "enabled" | "smtp_host" | "smtp_port" | "from_email" | "smtp_user">,
  hasPassword: boolean,
): boolean {
  if (!settings.enabled) return false;
  if (!settings.smtp_host || !settings.smtp_port || !settings.from_email) return false;
  if (settings.smtp_user && !hasPassword) return false;
  return true;
}

export const MASKED_SECRET = "••••••••";

/* ─────────────────────────────────────────────────────────────
 * Normalización de filas de la base de datos
 * ───────────────────────────────────────────────────────────── */

/** Convierte la fila de `email_settings` en una configuración segura con valores por defecto. */
export function normalizeStoredEmailSettings(row: unknown): EmailSettingsDraft {
  const record = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
  const security = record.smtp_security === "ssl" || record.smtp_security === "none"
    ? record.smtp_security
    : "tls";
  const port = Number(record.smtp_port);
  const alertConfig = { ...ALERT_CONFIG_DEFAULTS };
  const storedConfig = (record.alert_config && typeof record.alert_config === "object" ? record.alert_config : {}) as Record<string, unknown>;
  for (const key of Object.keys(alertConfig) as AlertType[]) {
    if (typeof storedConfig[key] === "boolean") alertConfig[key] = storedConfig[key] as boolean;
  }
  return {
    enabled: record.enabled === true,
    smtp_host: typeof record.smtp_host === "string" && record.smtp_host.trim() ? record.smtp_host.trim() : "smtp.gmail.com",
    smtp_port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 587,
    smtp_security: security,
    smtp_user: typeof record.smtp_user === "string" && record.smtp_user.trim() ? record.smtp_user.trim() : null,
    from_email: typeof record.from_email === "string" && record.from_email.trim() ? record.from_email.trim() : null,
    from_name: typeof record.from_name === "string" && record.from_name.trim() ? record.from_name.trim() : null,
    reply_to: typeof record.reply_to === "string" && record.reply_to.trim() ? record.reply_to.trim() : null,
    alert_config: alertConfig,
  };
}

/**
 * Combina las filas de `notification_rules` con los valores por defecto.
 * `enabledTypes` indica qué alertas genera el motor; `rules` aporta los umbrales.
 */
export function mergeAlertRules(
  rows: { rule_key: string; enabled?: boolean | null; config?: Record<string, unknown> | null }[],
): { rules: AlertRules; enabledTypes: Record<AlertType, boolean> } {
  const rules: AlertRules = { ...DEFAULT_ALERT_RULES };
  const enabledTypes: Record<AlertType, boolean> = { ...ALERT_CONFIG_DEFAULTS };
  for (const row of rows) {
    const key = row.rule_key as AlertType;
    if (!(key in enabledTypes)) continue;
    if (typeof row.enabled === "boolean") enabledTypes[key] = row.enabled;
    const config = row.config || {};
    const hours = Number(config.hours);
    const average = Number(config.average);
    const overdue = Number(config.overdue);
    if (key === "task_due_soon" && Number.isFinite(hours) && hours > 0) rules.dueSoonHours = hours;
    if (key === "submission_pending_review" && Number.isFinite(hours) && hours > 0) rules.pendingReviewHours = hours;
    if (key === "student_at_risk") {
      if (Number.isFinite(average) && average > 0) rules.atRiskAverage = average;
      if (Number.isFinite(overdue) && overdue > 0) rules.overdueLimitForRisk = overdue;
    }
  }
  return { rules, enabledTypes };
}

