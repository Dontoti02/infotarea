import test from 'node:test';
import assert from 'node:assert/strict';

// Import domain logic functions (tested under TDD Red-Green-Refactor)
// Note: We replicate or import the pure JS logic for direct Node execution
function validateUserRegistration(input) {
  const errors = [];
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

  return { valid: errors.length === 0, errors };
}

function validateTaskCreation(task) {
  const errors = [];
  if (!task.title || task.title.trim().length < 3) {
    errors.push('El título de la tarea debe tener al menos 3 caracteres.');
  }
  if (!task.courseId || !task.courseId.trim()) {
    errors.push('Debe asignarse un curso a la tarea.');
  }
  if (!task.dueDate) {
    errors.push('La fecha de vencimiento es obligatoria.');
  }
  const validTypes = ['homework', 'forum', 'exam'];
  if (!task.taskType || !validTypes.includes(task.taskType)) {
    errors.push('El tipo de tarea no es válido.');
  }
  if (task.taskType === 'exam' && (!task.durationMinutes || task.durationMinutes <= 0)) {
    errors.push('Los exámenes deben contar con un tiempo límite en minutos.');
  }
  return { valid: errors.length === 0, errors };
}

function evaluateSubmissionStatus(submittedAt, dueDate) {
  const subDate = new Date(submittedAt);
  const due = new Date(dueDate);
  return subDate.getTime() <= due.getTime() ? 'on_time' : 'late';
}

function validateGradeEvaluation(score, max = 20) {
  const errors = [];
  if (typeof score !== 'number' || isNaN(score)) {
    errors.push('La calificación debe ser un valor numérico.');
    return { valid: false, errors };
  }
  if (score < 0 || score > max) {
    errors.push(`La nota debe estar en el rango de 0 a ${max}.`);
    return { valid: false, errors };
  }
  let letterGrade = 'C';
  const percentage = (score / max) * 100;
  if (percentage >= 90) letterGrade = 'AD';
  else if (percentage >= 70) letterGrade = 'A';
  else if (percentage >= 55) letterGrade = 'B';
  else letterGrade = 'C';

  return { valid: true, errors: [], letterGrade };
}

function processAcademicPeriodClosing(yearNumber, yearLabel) {
  if (!yearNumber || yearNumber < 2000 || yearNumber > 2100) {
    throw new Error('El año escolar debe ser un año válido de 4 dígitos.');
  }
  if (!yearLabel || !yearLabel.trim()) {
    throw new Error('La etiqueta del año escolar es obligatoria.');
  }
  return {
    year_label: yearLabel.trim(),
    start_year: yearNumber,
    end_year: yearNumber + 1
  };
}

function formatRelativeTime(dateStr, baseNow = new Date()) {
  const date = new Date(dateStr);
  const diffMs = baseNow.getTime() - date.getTime();
  if (diffMs < 0) return 'En el futuro';
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs} hora${diffHrs !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  return 'Fecha anterior';
}

function validateChatMessage(input) {
  const errors = [];
  if (!input.senderId || !input.senderId.trim()) {
    errors.push('El remitente del mensaje es obligatorio.');
  }
  if (!input.content || !input.content.trim()) {
    errors.push('El contenido del mensaje no puede estar vacío.');
  } else if (input.content.trim().length > 2000) {
    errors.push('El mensaje excede el límite máximo de 2000 caracteres.');
  }
  const validChannels = ['teacher_student', 'admin_teacher', 'student_parent'];
  if (!input.channelType || !validChannels.includes(input.channelType)) {
    errors.push('El canal de comunicación no es válido.');
  }
  return { valid: errors.length === 0, errors };
}

function validateAdminTeacherNotice(input) {
  const errors = [];
  if (!input.adminId || !input.adminId.trim()) {
    errors.push('El identificador del emisor administrativo es obligatorio.');
  }
  if (!input.title || input.title.trim().length < 4) {
    errors.push('El título del aviso a docentes debe tener al menos 4 caracteres.');
  }
  if (!input.content || input.content.trim().length < 10) {
    errors.push('El contenido del comunicado debe contener al menos 10 caracteres.');
  }
  return { valid: errors.length === 0, errors };
}

function processParentProgressiveFlow(input) {
  const errors = [];
  if (!input.studentId || !input.studentId.trim()) {
    errors.push('El ID del estudiante es obligatorio.');
  }
  if (input.targetStage >= 2 && !input.parentEmail && !input.parentPhone) {
    errors.push('Se requiere correo electrónico o teléfono del apoderado.');
  }
  if (errors.length > 0) {
    return { success: false, errors, currentStage: input.currentStage };
  }
  const stage = input.targetStage;
  const status = stage === 3 ? 'active' : stage === 2 ? 'linked' : 'pending';
  return {
    success: true,
    currentStage: stage,
    status,
    inviteCode: `PADRE-${input.studentId.substring(0, 4).toUpperCase()}-2026`,
    errors: []
  };
}

// ==========================================
// SUITE DE PRUEBAS TDD: VALIDACIÓN Y LÓGICA
// ==========================================

test('TDD-01: Validar registro exitoso de docente', () => {
  const input = {
    email: 'profesor.garcia@infotarea.edu',
    password: 'Password123!',
    full_name: 'Carlos García',
    role: 'teacher'
  };
  const result = validateUserRegistration(input);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('TDD-02: Rechazar registro de estudiante sin aula/sección asignada', () => {
  const input = {
    email: 'juan.perez@infotarea.edu',
    password: 'Password123!',
    full_name: 'Juan Pérez',
    role: 'student'
    // section omitido a propósito
  };
  const result = validateUserRegistration(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('Los estudiantes deben tener una sección o aula asignada.'));
});

test('TDD-03: Rechazar contraseña con menos de 6 caracteres', () => {
  const input = {
    email: 'admin@infotarea.edu',
    password: '123',
    full_name: 'Admin Principal',
    role: 'admin'
  };
  const result = validateUserRegistration(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('La contraseña debe tener al menos 6 caracteres.'));
});

test('TDD-04: Rechazar correo electrónico con formato inválido', () => {
  const input = {
    email: 'correo-sin-arroba.com',
    password: 'Password123!',
    full_name: 'Carlos Gomez',
    role: 'teacher'
  };
  const result = validateUserRegistration(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('El formato del correo electrónico es inválido.'));
});

test('TDD-05: Validar creación de examen con duración obligatoria', () => {
  const invalidExam = {
    title: 'Examen Parcial de Matemáticas',
    courseId: 'course-uuid-123',
    dueDate: '2026-10-30T10:00:00Z',
    taskType: 'exam'
    // durationMinutes omitido
  };
  const resInvalid = validateTaskCreation(invalidExam);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.includes('Los exámenes deben contar con un tiempo límite en minutos.'));

  const validExam = {
    ...invalidExam,
    durationMinutes: 60
  };
  const resValid = validateTaskCreation(validExam);
  assert.equal(resValid.valid, true);
});

test('TDD-06: Evaluar entrega a tiempo vs fuera de plazo (on_time vs late)', () => {
  const dueDate = '2026-10-15T23:59:59Z';
  const onTimeSubmission = '2026-10-15T20:00:00Z';
  const lateSubmission = '2026-10-16T08:30:00Z';

  assert.equal(evaluateSubmissionStatus(onTimeSubmission, dueDate), 'on_time');
  assert.equal(evaluateSubmissionStatus(lateSubmission, dueDate), 'late');
});

test('TDD-07: Validar calificaciones en escala vigesimal y calcular escala cualitativa', () => {
  // Nota 19 -> AD (Logro Destacado)
  const resAD = validateGradeEvaluation(19, 20);
  assert.equal(resAD.valid, true);
  assert.equal(resAD.letterGrade, 'AD');

  // Nota 15 -> A (Logro Esperado)
  const resA = validateGradeEvaluation(15, 20);
  assert.equal(resA.valid, true);
  assert.equal(resA.letterGrade, 'A');

  // Nota 12 -> B (En Proceso)
  const resB = validateGradeEvaluation(12, 20);
  assert.equal(resB.valid, true);
  assert.equal(resB.letterGrade, 'B');

  // Nota 08 -> C (En Inicio)
  const resC = validateGradeEvaluation(8, 20);
  assert.equal(resC.valid, true);
  assert.equal(resC.letterGrade, 'C');

  // Fuera de rango (> 20)
  const resOverflow = validateGradeEvaluation(25, 20);
  assert.equal(resOverflow.valid, false);

  // Negativo (< 0)
  const resNegative = validateGradeEvaluation(-2, 20);
  assert.equal(resNegative.valid, false);
});

test('TDD-08: Calcular periodo lectivo para cierre de año escolar', () => {
  const period = processAcademicPeriodClosing(2026, 'Año Académico 2026 - Bicentenario');
  assert.equal(period.start_year, 2026);
  assert.equal(period.end_year, 2027);
  assert.equal(period.year_label, 'Año Académico 2026 - Bicentenario');

  // Validar rechazo con año menor a 2000
  assert.throws(() => {
    processAcademicPeriodClosing(1990, 'Año Antiguo');
  }, /año escolar debe ser un año válido/);
});

test('TDD-09: Formatear tiempos relativos para el feed de notificaciones', () => {
  const baseTime = new Date('2026-09-24T12:00:00Z');
  
  const justNow = new Date('2026-09-24T11:59:45Z').toISOString();
  assert.equal(formatRelativeTime(justNow, baseTime), 'Ahora');

  const tenMinAgo = new Date('2026-09-24T11:50:00Z').toISOString();
  assert.equal(formatRelativeTime(tenMinAgo, baseTime), 'Hace 10 min');

  const twoHoursAgo = new Date('2026-09-24T10:00:00Z').toISOString();
  assert.equal(formatRelativeTime(twoHoursAgo, baseTime), 'Hace 2 horas');

  const threeDaysAgo = new Date('2026-09-21T12:00:00Z').toISOString();
  assert.equal(formatRelativeTime(threeDaysAgo, baseTime), 'Hace 3 días');
});

// ==============================================================
// PRUEBAS TDD - ITERACIÓN Nº 3 (ENTREGA INCREMENTAL)
// ==============================================================

test('TDD-10: Validar envío y validación de mensajes en chat Docente-Estudiante (HU-12)', () => {
  // Caso válido
  const validMsg = validateChatMessage({
    senderId: 'teacher-uuid-1',
    channelType: 'teacher_student',
    content: 'Estimado estudiante, la retroalimentación está en su entrega.'
  });
  assert.equal(validMsg.valid, true);
  assert.equal(validMsg.errors.length, 0);

  // Caso inválido: mensaje vacío
  const emptyMsg = validateChatMessage({
    senderId: 'student-uuid-1',
    channelType: 'teacher_student',
    content: '   '
  });
  assert.equal(emptyMsg.valid, false);
  assert.ok(emptyMsg.errors.includes('El contenido del mensaje no puede estar vacío.'));

  // Caso inválido: canal desconocido
  const invalidChannel = validateChatMessage({
    senderId: 'student-uuid-1',
    channelType: 'unknown_channel',
    content: 'Hola'
  });
  assert.equal(invalidChannel.valid, false);
});

test('TDD-11: Validar avisos y mensajes entre Administrador y Docente (HU-13)', () => {
  // Caso válido: aviso oficial completo
  const validNotice = validateAdminTeacherNotice({
    adminId: 'admin-dir-1',
    title: 'Circular Pedagógica 05',
    content: 'Reunión de coordinación docente este viernes a las 15:00 horas.'
  });
  assert.equal(validNotice.valid, true);

  // Caso inválido: título demasiado corto
  const shortTitle = validateAdminTeacherNotice({
    adminId: 'admin-dir-1',
    title: 'A',
    content: 'Reunión general'
  });
  assert.equal(shortTitle.valid, false);
  assert.ok(shortTitle.errors.some(e => e.includes('al menos 4 caracteres')));
});

test('TDD-12: Validar avance y estados de la habilitación progresiva Estudiante-Padre (HU-14)', () => {
  // Fase 1: Vinculación con generación de código
  const f1 = processParentProgressiveFlow({
    studentId: 'stud-1234',
    currentStage: 1,
    targetStage: 1
  });
  assert.equal(f1.success, true);
  assert.equal(f1.status, 'pending');
  assert.equal(f1.inviteCode, 'PADRE-STUD-2026');

  // Fase 2: Requiere email o teléfono del apoderado
  const f2SinContacto = processParentProgressiveFlow({
    studentId: 'stud-1234',
    currentStage: 1,
    targetStage: 2
  });
  assert.equal(f2SinContacto.success, false);

  const f2ConContacto = processParentProgressiveFlow({
    studentId: 'stud-1234',
    parentEmail: 'apoderado@familia.edu',
    currentStage: 1,
    targetStage: 2
  });
  assert.equal(f2ConContacto.success, true);
  assert.equal(f2ConContacto.status, 'linked');

  // Fase 3: Canal completamente activo al 100%
  const f3 = processParentProgressiveFlow({
    studentId: 'stud-1234',
    parentEmail: 'apoderado@familia.edu',
    currentStage: 2,
    targetStage: 3
  });
  assert.equal(f3.success, true);
  assert.equal(f3.status, 'active');
});

