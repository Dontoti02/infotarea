/**
 * Lógica de Dominio y Validaciones de Negocio para InfoTarea
 * Desarrollado bajo enfoque TDD (Test-Driven Development)
 */

export interface UserRegistrationInput {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'student';
  section?: string;
}

export interface TaskInput {
  title: string;
  description: string;
  dueDate: string;
  taskType: 'homework' | 'forum' | 'exam';
  courseId: string;
  durationMinutes?: number;
}

export interface SubmissionInput {
  taskId: string;
  studentId: string;
  content: string;
  fileUrl?: string;
  submittedAt: Date;
  dueDate: Date;
}

export interface GradeInput {
  score: number;
  maxScore?: number;
  feedback?: string;
}

export interface AcademicPeriodInput {
  yearNumber: number;
  yearLabel: string;
}

/**
 * Valida los datos requeridos para registrar un usuario
 */
export function validateUserRegistration(input: Partial<UserRegistrationInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.email || !input.email.trim()) {
    errors.push('El correo electrónico es obligatorio.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      errors.push('El formato del correo electrónico es inválido.');
    }
  }

  if (!input.password || input.password.length < 6) {
    errors.push('La contraseña debe tener al menos 6 caracteres.');
  }

  if (!input.full_name || !input.full_name.trim()) {
    errors.push('El nombre completo es obligatorio.');
  }

  const validRoles = ['admin', 'teacher', 'student'];
  if (!input.role || !validRoles.includes(input.role)) {
    errors.push('El rol seleccionado no es válido.');
  }

  if (input.role === 'student' && (!input.section || !input.section.trim())) {
    errors.push('Los estudiantes deben tener una sección o aula asignada.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida la creación de una tarea académica
 */
export function validateTaskCreation(task: Partial<TaskInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!task.title || task.title.trim().length < 3) {
    errors.push('El título de la tarea debe tener al menos 3 caracteres.');
  }

  if (!task.courseId || !task.courseId.trim()) {
    errors.push('Debe asignarse un curso a la tarea.');
  }

  if (!task.dueDate) {
    errors.push('La fecha de vencimiento es obligatoria.');
  } else {
    const due = new Date(task.dueDate);
    if (isNaN(due.getTime())) {
      errors.push('La fecha de vencimiento no es válida.');
    }
  }

  const validTypes = ['homework', 'forum', 'exam'];
  if (!task.taskType || !validTypes.includes(task.taskType)) {
    errors.push('El tipo de tarea no es válido.');
  }

  if (task.taskType === 'exam' && (!task.durationMinutes || task.durationMinutes <= 0)) {
    errors.push('Los exámenes deben contar con un tiempo límite en minutos.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Determina el estado de una entrega según su fecha límite
 */
export function evaluateSubmissionStatus(submission: SubmissionInput): 'on_time' | 'late' {
  if (submission.submittedAt.getTime() <= submission.dueDate.getTime()) {
    return 'on_time';
  }
  return 'late';
}

/**
 * Valida la calificación asignada por un docente (escala vigesimal 0 - 20)
 */
export function validateGradeEvaluation(grade: GradeInput): { valid: boolean; errors: string[]; letterGrade?: string } {
  const errors: string[] = [];
  const max = grade.maxScore ?? 20;

  if (typeof grade.score !== 'number' || isNaN(grade.score)) {
    errors.push('La calificación debe ser un valor numérico.');
    return { valid: false, errors };
  }

  if (grade.score < 0 || grade.score > max) {
    errors.push(`La nota debe estar en el rango de 0 a ${max}.`);
    return { valid: false, errors };
  }

  let letterGrade = 'C';
  const percentage = (grade.score / max) * 100;
  if (percentage >= 90) letterGrade = 'AD'; // Logro Destacado
  else if (percentage >= 70) letterGrade = 'A'; // Logro Esperado
  else if (percentage >= 55) letterGrade = 'B'; // En Proceso
  else letterGrade = 'C'; // En Inicio

  return {
    valid: true,
    errors: [],
    letterGrade
  };
}

/**
 * Procesa el periodo lectivo para el cierre de año escolar
 */
export function processAcademicPeriodClosing(input: AcademicPeriodInput) {
  if (!input.yearNumber || input.yearNumber < 2000 || input.yearNumber > 2100) {
    throw new Error('El año escolar debe ser un año válido de 4 dígitos.');
  }

  if (!input.yearLabel || !input.yearLabel.trim()) {
    throw new Error('La etiqueta del año escolar es obligatoria.');
  }

  return {
    year_label: input.yearLabel.trim(),
    start_year: input.yearNumber,
    end_year: input.yearNumber + 1,
    closed_at: new Date().toISOString()
  };
}

/**
 * Formatea tiempo relativo amigable para el usuario
 */
export function formatRelativeTime(dateStr: string, currentNow = new Date()): string {
  const date = new Date(dateStr);
  const diffMs = currentNow.getTime() - date.getTime();
  
  if (diffMs < 0) return 'En el futuro';
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs} hora${diffHrs !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// ==============================================================
// ITERACIÓN Nº 3 - TERCERA ENTREGA INCREMENTAL
// ==============================================================

export interface ChatMessageInput {
  senderId: string;
  senderRole: 'teacher' | 'student' | 'admin' | 'parent';
  receiverId?: string;
  receiverRole?: 'teacher' | 'student' | 'admin' | 'parent';
  courseId?: string;
  channelType: 'teacher_student' | 'admin_teacher' | 'student_parent' | 'teacher_parent';
  content: string;
}

export interface AdminTeacherNoticeInput {
  adminId: string;
  title: string;
  content: string;
  priority?: 'normal' | 'urgent';
  targetRole?: 'teacher';
}

export interface ParentProgressiveFlowInput {
  studentId: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  currentStage: 1 | 2 | 3;
  targetStage: 1 | 2 | 3;
  shareGrades?: boolean;
  shareTasks?: boolean;
}

/**
 * 12. Comunicación Docente-Estudiante: chat y flujo principal
 * Valida los requisitos de mensajería directa en el canal pedagógico
 */
export function validateChatMessage(input: Partial<ChatMessageInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.senderId || !input.senderId.trim()) {
    errors.push('El remitente del mensaje es obligatorio.');
  }

  if (!input.content || !input.content.trim()) {
    errors.push('El contenido del mensaje no puede estar vacío.');
  } else if (input.content.trim().length > 2000) {
    errors.push('El mensaje excede el límite máximo de 2000 caracteres.');
  }

  const validChannels = ['teacher_student', 'admin_teacher', 'student_parent', 'teacher_parent'];
  if (!input.channelType || !validChannels.includes(input.channelType)) {
    errors.push('El canal de comunicación no es válido.');
  }

  // Reglas específicas de rol para canal teacher_student
  if (input.channelType === 'teacher_student') {
    if (input.senderRole && !['teacher', 'student'].includes(input.senderRole)) {
      errors.push('El chat docente-estudiante solo admite participantes con rol docente o estudiante.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 13. Comunicación Administrador-Docente: avisos y mensajes
 * Valida la emisión de circulares, avisos prioritarios y mensajes oficiales
 */
export function validateAdminTeacherNotice(input: Partial<AdminTeacherNoticeInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.adminId || !input.adminId.trim()) {
    errors.push('El identificador del emisor administrativo es obligatorio.');
  }

  if (!input.title || input.title.trim().length < 4) {
    errors.push('El título del aviso a docentes debe tener al menos 4 caracteres.');
  }

  if (!input.content || input.content.trim().length < 10) {
    errors.push('El contenido del comunicado debe contener al menos 10 caracteres.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 14. Comunicación Estudiante-Padre: habilitación progresiva del flujo
 * Procesa el avance estructurado por etapas (Fase 1: Vinculación, Fase 2: Alcance, Fase 3: Canal activo)
 */
export function processParentProgressiveFlow(input: ParentProgressiveFlowInput): {
  success: boolean;
  currentStage: 1 | 2 | 3;
  status: 'pending' | 'linked' | 'active';
  inviteCode: string;
  message: string;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.studentId || !input.studentId.trim()) {
    errors.push('El ID del estudiante es obligatorio.');
  }

  // Si avanza a la etapa 2 o 3, debe tener correo o teléfono del padre
  if (input.targetStage >= 2) {
    if (!input.parentEmail && !input.parentPhone) {
      errors.push('Se requiere correo electrónico o teléfono del apoderado para avanzar a la fase de permisos.');
    } else if (input.parentEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.parentEmail)) {
        errors.push('El formato del correo del apoderado es inválido.');
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      currentStage: input.currentStage,
      status: input.currentStage === 3 ? 'active' : input.currentStage === 2 ? 'linked' : 'pending',
      inviteCode: '',
      message: 'Fallo al avanzar en el flujo progresivo.',
      errors
    };
  }

  const stage = input.targetStage;
  const status: 'pending' | 'linked' | 'active' = stage === 3 ? 'active' : stage === 2 ? 'linked' : 'pending';
  const cleanId = input.studentId.substring(0, 4).toUpperCase();
  const inviteCode = `PADRE-${cleanId}-2026`;

  const messagesByStage: Record<1 | 2 | 3, string> = {
    1: 'Fase 1 activada: Código de invitación familiar generado con éxito.',
    2: 'Fase 2 activada: Permisos de visualización académica configurados.',
    3: 'Fase 3 activada: Flujo de mensajería y alertas bidireccional completamente habilitado.'
  };

  return {
    success: true,
    currentStage: stage,
    status,
    inviteCode,
    message: messagesByStage[stage],
    errors: []
  };
}

