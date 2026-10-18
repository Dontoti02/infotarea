import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS DE ACEPTACIÓN (ACCEPTANCE / BDD TESTS)
 * Iteración Nº 4 — Cuarta entrega incremental
 *
 *   Ítem 21: reglas y estructuras de priorización de tareas y generación de avisos.
 *   Ítem 22: componente inteligente de clasificación y resúmenes de entregas.
 *   Ítem 23: correo saliente y alertas automáticas de seguimiento académico.
 *
 * Los escenarios usan el módulo real de reglas puras
 * (`src/shared/utils/prioritization.ts`), sin depender de Supabase ni del SMTP.
 */

const realRequire = createRequire(import.meta.url);

function loadModule(relative) {
  const path = new URL(relative, import.meta.url);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path.pathname,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', 'require', output)(loadedModule, loadedModule.exports, realRequire);
  return loadedModule.exports;
}

const rules = loadModule('../../src/shared/utils/prioritization.ts');
const NOW = new Date('2026-10-18T12:00:00Z');

const person = (id, full_name, role, email = null) => ({ id, full_name, role, email });
const course = (id, name, teacherId) => ({ id, name, section: '4A', teacher_id: teacherId });
const task = (id, title, task_type, due_date, courseId) => ({ id, title, task_type, due_date, course_id: courseId });
const submission = (id, taskId, studentId, status, score, createdAt = null) => ({
  id, task_id: taskId, student_id: studentId, status, score, created_at: createdAt,
});

const TEACHER = person('pr1', 'Prof. Ruiz', 'teacher', 'ruiz@escuela.edu');
const ADMIN = person('ad1', 'Dirección', 'admin', 'direccion@escuela.edu');

test('ACEP-11: Ítem 21 — la priorización ordena primero lo crítico y explica cada motivo', () => {
  // GIVEN: un aula con una tarea vencida, una que vence mañana y un foro lejano
  const classroom = {
    tasks: [
      task('t1', 'Examen final de Matemática', 'exam', '2026-10-17T12:00:00Z', 'c1'),
      task('t2', 'Práctica calificada', 'homework', '2026-10-19T00:00:00Z', 'c1'),
      task('t3', 'Foro de lectura', 'forum', '2026-12-01T12:00:00Z', 'c1'),
    ],
    submissions: [
      submission('s1', 't2', 'st1', 'pending', null),
      submission('s2', 't3', 'st1', 'reviewed', 18),
    ],
    courses: [course('c1', 'Comunicación', 'pr1')],
  };

  // WHEN: el componente inteligente clasifica las tareas del aula
  const classified = rules.classifyTasks(classroom, NOW);
  const byId = Object.fromEntries(classified.map(item => [item.taskId, item]));

  // THEN: el examen vencido encabeza la lista como crítico y con motivos legibles
  assert.equal(classified[0].taskId, 't1');
  assert.equal(byId.t1.level, 'critica');
  assert.ok(byId.t1.reasons.includes('Examen'));
  assert.ok(byId.t1.reasons.some(reason => /Venció/.test(reason)));
  assert.ok(byId.t1.reasons.includes('Sin entregas registradas'));
  assert.equal(byId.t2.level, 'alta');
  assert.ok(byId.t2.reasons.includes('Vence en 12 h'));
  assert.equal(byId.t3.level, 'baja');
});

test('ACEP-12: Ítem 21 — los avisos llegan a estudiantes, docente y dirección sin duplicarse', () => {
  // GIVEN: una tarea que vence en 24 h con una estudiante pendiente
  const classroom = {
    tasks: [task('t1', 'Informe final', 'homework', '2026-10-19T12:00:00Z', 'c1')],
    submissions: [submission('s1', 't1', 'st2', 'pending', null)],
    people: [
      person('st1', 'Mateo Rojas', 'student', 'mateo@escuela.edu'),
      person('st2', 'Ana Vega', 'student', 'ana@escuela.edu'),
      TEACHER,
      ADMIN,
    ],
    courses: [course('c1', 'Comunicación', 'pr1')],
    memberships: [
      { course_id: 'c1', profile_id: 'st1' },
      { course_id: 'c1', profile_id: 'st2' },
    ],
  };

  // WHEN: el motor genera los avisos del día
  const candidates = rules.buildAlertCandidates(classroom, NOW);
  const dueSoon = candidates.find(candidate => candidate.alertType === 'task_due_soon');
  const again = rules.buildAlertCandidates(classroom, NOW);

  // THEN: solo avisa a la estudiante pendiente, al docente y a la dirección,
  //       y repite la misma clave de deduplicación durante el día
  assert.ok(dueSoon);
  assert.equal(dueSoon.severity, 'critica');
  assert.equal(dueSoon.dedupeKey, 'due_soon:t1:2026-10-18');
  assert.deepEqual(dueSoon.audience.map(audience => audience.profileId).sort(), ['ad1', 'pr1', 'st1']);
  assert.equal(again.find(candidate => candidate.alertType === 'task_due_soon').dedupeKey, dueSoon.dedupeKey);

  // Y una tarea vencida se avisa una sola vez, aunque pasen los días
  const overdueClassroom = {
    ...classroom,
    tasks: [task('t9', 'Ensayo histórico', 'essay', '2026-10-01T12:00:00Z', 'c1')],
  };
  const first = rules.buildAlertCandidates(overdueClassroom, NOW).find(candidate => candidate.alertType === 'task_overdue');
  const later = rules.buildAlertCandidates(overdueClassroom, new Date('2026-10-25T12:00:00Z')).find(candidate => candidate.alertType === 'task_overdue');
  assert.equal(first.dedupeKey, 'overdue:t9');
  assert.equal(later.dedupeKey, first.dedupeKey);
});

test('ACEP-13: Ítem 22 — el panel inteligente resume las entregas y detecta estudiantes en riesgo', () => {
  // GIVEN: un aula con una estudiante con nota baja, otra al día y un estudiante sin actividad
  const classroom = {
    students: [
      person('st1', 'Mateo Rojas', 'student', 'mateo@escuela.edu'),
      person('st2', 'Ana Vega', 'student', 'ana@escuela.edu'),
      person('st3', 'Luis Sin Actividad', 'student', 'luis@escuela.edu'),
    ],
    tasks: [
      task('t1', 'Vencida', 'homework', '2026-10-10T12:00:00Z', 'c1'),
      task('t2', 'Próxima', 'homework', '2026-10-30T12:00:00Z', 'c1'),
    ],
    submissions: [
      submission('s1', 't1', 'st1', 'reviewed', 4),
      submission('s2', 't2', 'st1', 'pending', null),
      submission('s3', 't1', 'st2', 'reviewed', 9),
      submission('s4', 't2', 'st2', 'pending', null),
    ],
    memberships: [
      { course_id: 'c1', profile_id: 'st1' },
      { course_id: 'c1', profile_id: 'st2' },
      { course_id: 'c1', profile_id: 'st3' },
    ],
  };

  // WHEN: la dirección abre el resumen de entregas del componente inteligente
  const summaries = rules.buildDeliverySummary(classroom, NOW);
  const byStudent = Object.fromEntries(summaries.map(summary => [summary.studentId, summary]));
  const classified = rules.classifyTasks({ tasks: classroom.tasks, submissions: classroom.submissions, courses: [course('c1', 'Historia', 'pr1')] }, NOW);
  const metrics = rules.buildSmartMetrics(classified, summaries, NOW);

  // THEN: cada estudiante muestra su avance y su nivel de riesgo, y el panel totaliza
  assert.equal(byStudent.st1.progress, 1);
  assert.equal(byStudent.st1.averageScore, 4);
  assert.equal(byStudent.st1.riskLevel, 'en_riesgo');
  assert.equal(byStudent.st2.pendingReview, 1);
  assert.equal(byStudent.st2.riskLevel, 'al_dia');
  assert.equal(byStudent.st3.submitted, 0);
  assert.equal(byStudent.st3.riskLevel, 'sin_actividad');
  assert.equal(metrics.totalTasks, 2);
  assert.equal(metrics.overdue, 1);
  assert.equal(metrics.pendingReviews, 2);
  assert.equal(metrics.atRisk, 1);
});

test('ACEP-14: Ítem 23 — la dirección configura Gmail con contraseña de aplicación y prueba el envío', () => {
  // GIVEN: la cuenta institucional de Gmail con verificación en dos pasos
  const input = {
    enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_security: 'tls',
    smtp_user: 'colegio@gmail.com',
    from_email: 'colegio@gmail.com',
    from_name: 'Colegio InfoTarea',
    reply_to: 'secretaria@colegio.edu',
    smtp_password: 'abcd efgh ijkl mnop',
  };

  // WHEN: la dirección guarda la configuración y la plataforma prepara el transporte
  const validation = rules.validateEmailSettingsInput(input);
  const transport = rules.smtpTransportOptions(validation.settings, 'abcdefghijklmnop');
  const ready = rules.isSmtpConfigured(validation.settings, true);

  // THEN: la configuración es válida y el transporte usa TLS 1.2 en el puerto 587
  assert.equal(validation.valid, true, validation.errors.join(' · '));
  assert.equal(validation.passwordAction, 'set');
  assert.equal(validation.password, 'abcdefghijklmnop');
  assert.equal(transport.host, 'smtp.gmail.com');
  assert.equal(transport.port, 587);
  assert.equal(transport.secure, false);
  assert.equal(transport.requireTLS, true);
  assert.deepEqual(transport.auth, { user: 'colegio@gmail.com', pass: 'abcdefghijklmnop' });
  assert.equal(ready, true);

  // Y si la contraseña de aplicación falta, el envío no se considera listo
  assert.equal(rules.isSmtpConfigured(validation.settings, false), false);
  assert.equal(rules.isSmtpConfigured({ ...validation.settings, enabled: false }, true), false);
});

test('ACEP-15: Ítem 23 — una configuración insegura o incompleta no permite activar el correo', () => {
  // GIVEN: la dirección ensaya variantes equivocadas de la cuenta de correo
  const base = { enabled: true, smtp_host: 'smtp.gmail.com', from_email: 'colegio@gmail.com' };

  // WHEN: la plataforma valida cada intento
  const wrongPort = rules.validateEmailSettingsInput({ ...base, smtp_port: 587, smtp_security: 'ssl' });
  const withoutSender = rules.validateEmailSettingsInput({ ...base, from_email: '', smtp_port: 587, smtp_security: 'tls' });
  const shortPassword = rules.validateEmailSettingsInput({ ...base, smtp_port: 587, smtp_security: 'tls', smtp_password: '1234' });
  const wrongPortNumber = rules.validateEmailSettingsInput({ ...base, smtp_port: 70000, smtp_security: 'tls' });

  // THEN: ninguna se acepta y los mensajes explican qué corregir
  for (const attempt of [wrongPort, withoutSender, shortPassword, wrongPortNumber]) {
    assert.equal(attempt.valid, false);
    assert.ok(attempt.errors.length > 0);
  }
  assert.ok(wrongPort.errors.some(error => /Gmail.*465/.test(error)));
  assert.ok(withoutSender.errors.some(error => /correo remitente válido/.test(error)));
  assert.ok(shortPassword.errors.some(error => /al menos 8 caracteres/.test(error)));
  assert.ok(wrongPortNumber.errors.some(error => /entre 1 y 65535/.test(error)));
});

test('ACEP-16: Ítem 23 — cada destinatario recibe un único resumen priorizado por severidad', () => {
  // GIVEN: alertas de distinta severidad para estudiantes, docente y dirección,
  //        con un docente de otra aula que no participa
  const classroom = {
    tasks: [
      task('t1', 'Examen vencido', 'exam', '2026-10-01T12:00:00Z', 'c1'),
      task('t2', 'Informe próximo', 'homework', '2026-10-19T12:00:00Z', 'c1'),
    ],
    submissions: [submission('s1', 't2', 'st1', 'pending', null, '2026-10-10T12:00:00Z')],
    people: [
      person('st1', 'Mateo Rojas', 'student', 'mateo@escuela.edu'),
      person('st2', 'Ana Vega', 'student', 'ana@escuela.edu'),
      TEACHER,
      ADMIN,
      person('pr9', 'Prof. Ajeno', 'teacher', 'ajeno@escuela.edu'),
    ],
    courses: [course('c1', 'Comunicación', 'pr1'), course('c2', 'Otra aula', 'pr9')],
    memberships: [{ course_id: 'c1', profile_id: 'st1' }, { course_id: 'c1', profile_id: 'st2' }],
  };

  // WHEN: el motor agrupa los avisos en correos por destinatario
  const candidates = rules.buildAlertCandidates(classroom, NOW);
  const digests = rules.buildEmailDigests(candidates);
  const byEmail = Object.fromEntries(digests.map(digest => [digest.to, digest]));

  // THEN: nadie recibe correos duplicados, el orden empieza por lo crítico
  //       y el docente ajeno queda fuera del envío
  assert.deepEqual(Object.keys(byEmail).sort(), ['ana@escuela.edu', 'direccion@escuela.edu', 'mateo@escuela.edu', 'ruiz@escuela.edu']);
  assert.equal(byEmail['ajeno@escuela.edu'], undefined);
  assert.equal(byEmail['direccion@escuela.edu'].alerts[0].severity, 'critica');
  const teacherAlerts = byEmail['ruiz@escuela.edu'].alerts.map(alert => alert.severity);
  assert.deepEqual(teacherAlerts, [...teacherAlerts].sort((a, b) => ['critica', 'alta', 'media', 'informativa'].indexOf(a) - ['critica', 'alta', 'media', 'informativa'].indexOf(b)));
  assert.match(byEmail['direccion@escuela.edu'].subject, /alertas de seguimiento académico/);
  assert.equal(new Set(byEmail['direccion@escuela.edu'].alerts.map(alert => alert.dedupeKey)).size, byEmail['direccion@escuela.edu'].alerts.length);
});

test('ACEP-17: Ítem 22/23 — el bajo rendimiento avisa al alumno en el sistema y por correo a docentes y padres', () => {
  // GIVEN: un estudiante con una entrega calificada con nota muy baja, su
  // docente de aula y su padre vinculado en la ficha familiar
  const classroom = {
    tasks: [task('t1', 'Álgebra', 'homework', '2026-10-30T12:00:00Z', 'c1')],
    submissions: [submission('s1', 't1', 'st1', 'reviewed', 3)],
    people: [
      person('st1', 'Mateo Rojas', 'student', 'mateo@escuela.edu'),
      TEACHER,
      ADMIN,
      person('pa1', 'Rosa Rojas', 'parent', 'rosa.rojas@casa.edu'),
    ],
    courses: [course('c1', 'Matemática', 'pr1')],
    memberships: [{ course_id: 'c1', profile_id: 'st1' }],
    parentLinks: [{ parent_profile_id: 'pa1', student_profile_id: 'st1' }],
  };

  // WHEN: el motor genera los avisos y los correos del seguimiento
  const candidates = rules.buildAlertCandidates(classroom, NOW);
  const atRisk = candidates.find(candidate => candidate.alertType === 'student_at_risk');
  const digests = rules.buildEmailDigests(candidates);

  // THEN: dentro del sistema el alumno ve la alerta de bajo rendimiento…
  assert.ok(atRisk);
  assert.equal(atRisk.studentId, 'st1');
  assert.equal(rules.studentAlertTitle(atRisk.alertType, atRisk.title), 'Tu rendimiento requiere atención');
  assert.match(atRisk.message, /Promedio 3/);

  // …y el correo llega solo a docentes y padres, con el nombre del estudiante;
  // el propio alumno no recibe correo y la dirección solo su resumen semanal.
  assert.deepEqual(atRisk.audience.map(a => a.role).sort(), ['parent', 'teacher']);
  assert.deepEqual(digests.map(d => d.to).sort(), ['direccion@escuela.edu', 'rosa.rojas@casa.edu', 'ruiz@escuela.edu']);
  assert.equal(digests.some(d => d.to === 'mateo@escuela.edu'), false);
  const parentDigest = digests.find(d => d.to === 'rosa.rojas@casa.edu');
  assert.equal(parentDigest.role, 'parent');
  assert.match(parentDigest.subject, /Mateo Rojas/);
  const adminDigest = digests.find(d => d.to === 'direccion@escuela.edu');
  assert.deepEqual(adminDigest.alerts.map(a => a.alertType), ['weekly_summary']);
});
