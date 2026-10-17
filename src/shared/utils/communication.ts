export const PRESENCE_TTL_MS = 45_000;
export const MAX_MESSAGE_LENGTH = 4000;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseHistoryCursor(createdAt: unknown, id: unknown): { createdAt: string; id: string } | null {
  if (typeof createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) || !isUuid(id)) return null;
  return { createdAt, id };
}

export function verifiedChildIds(links: { student_profile_id: string; verified_at?: string | null }[]): string[] {
  return [...new Set(links.filter(link => link.verified_at && Number.isFinite(Date.parse(link.verified_at))).map(link => link.student_profile_id))];
}

export interface FamilyLink {
  id: string;
  student_profile_id: string;
  linked_at: string;
  verified_at?: string | null;
}

// Code and database can be deployed separately. Only an absent verification
// column permits the legacy read; permission errors must remain errors.
export async function queryFamilyLinks<T>(query: (includeVerification: boolean) => PromiseLike<{
  data: T | null;
  error: { code?: string; message: string } | null;
}>) {
  const result = await query(true);
  const missingVerification = result.error
    && ["42703", "PGRST204"].includes(result.error.code || "")
    && /\bverified_at\b/i.test(result.error.message);
  if (!missingVerification) return { ...result, verificationAvailable: true };
  return { ...await query(false), verificationAvailable: false };
}

export const FAMILY_VERIFICATION_NOTICE = "El colegio aún debe activar la verificación de vínculos familiares. Los estudiantes vinculados se conservan.";

export function validatedMessageContent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const content = value.trim();
  return content.length > 0 && content.length <= MAX_MESSAGE_LENGTH ? content : null;
}

export function canModifyMessage(message: { id: string; sender_id: string }, userId: string) {
  return Boolean(userId) && message.sender_id === userId && !message.id.startsWith("tmp-");
}

export function mergeChatMessage<T extends { id: string }>(messages: T[], message: T, temporaryId?: string): T[] {
  const index = messages.findIndex(item => item.id === message.id || item.id === temporaryId);
  const result = messages.filter(item => item.id !== message.id && item.id !== temporaryId);
  result.splice(index < 0 ? result.length : Math.min(index, result.length), 0, message);
  return result;
}

export function activePresenceIds(sessions: { user_id: string; last_seen: string }[], now = Date.now()): string[] {
  return [...new Set(sessions.filter(session => {
    const age = now - Date.parse(session.last_seen);
    return age >= 0 && age < PRESENCE_TTL_MS;
  }).map(session => session.user_id))];
}

export interface PresenceSnapshot {
  receivedAt: number;
  serverTime: number;
  sessions: { user_id: string; last_seen: string }[];
}

export function presenceSnapshotIds(snapshot: PresenceSnapshot | null, now = Date.now()): string[] | null {
  if (!snapshot || now - snapshot.receivedAt >= PRESENCE_TTL_MS) return null;
  return activePresenceIds(snapshot.sessions, snapshot.serverTime + Math.max(0, now - snapshot.receivedAt));
}

export async function requestCommunicationJson<T>(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("Se agotó el tiempo de espera. Vuelve a intentarlo.", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json() as T;
    return { response, data };
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}

export function describeClassroom(value?: string | null) {
  const raw = value?.trim() || "";
  if (!raw) return { grade: null, section: null, label: "Sin aula asignada" };
  const normalized = raw.normalize("NFKC").toUpperCase();
  const match = normalized.match(/^(?:(?:PRIMARIA|SECUNDARIA)\s+)?(\d{1,2})\s*[.°Oº]?\s*(?:GRADO\s*)?[-/]?\s*(?:SECCI[ÓO]N\s*)?([A-Z])?$/);
  const grade = match?.[1] || null;
  const section = match?.[2] || (/^[A-Z]$/.test(normalized) ? normalized : null);
  const parts = [grade ? `Grado ${grade}` : "", section ? `Sección ${section}` : ""].filter(Boolean);
  return { grade, section, label: parts.join(" · ") || raw };
}

export interface AcademicCourse {
  id: string;
  name: string;
  section: string | null;
  teacher_id?: string | null;
  image_url?: string | null;
  teacher?: { id: string; full_name: string; email?: string | null } | null;
}

export function childAcademicInfo(profile: { course_members?: { courses: AcademicCourse | null }[] | null }) {
  const courses = [...new Map((profile.course_members || [])
    .map(member => member.courses).filter((course): course is AcademicCourse => Boolean(course))
    .map(course => [course.id, course])).values()];
  const sections = [...new Set(courses.map(course => course.section?.trim()).filter((section): section is string => Boolean(section)))].sort();
  const classrooms = sections.map(describeClassroom);
  const teachers = courses.flatMap(course => course.teacher ? [{
    id: course.teacher.id,
    full_name: course.teacher.full_name,
    email: course.teacher.email,
    courseName: course.name,
    section: course.section,
    classroomLabel: describeClassroom(course.section).label,
  }] : []);
  return {
    courses, teachers, classrooms,
    section: sections.length ? sections.join(", ") : null,
    grade: [...new Set(classrooms.flatMap(classroom => classroom.grade ? [classroom.grade] : []))].join(", ") || null,
    classroomLabel: classrooms.map(classroom => classroom.label).join(" / ") || "Sin aula asignada",
  };
}
