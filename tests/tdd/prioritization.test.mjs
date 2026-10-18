import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS TDD - ITERACIÓN Nº 4
 * 21. Reglas de priorización de tareas y generación de avisos.
 * 22. Clasificación y resúmenes de entregas del componente inteligente.
 * 23. Validación del correo saliente (SMTP) y resúmenes de correo.
 *
 * Las pruebas cargan el módulo real `src/shared/utils/prioritization.ts`
 * (sin dependencias externas) y verifican la lógica de negocio pura.
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

const logic = loadModule('../../src/shared/utils/prioritization.ts');
const NOW = new Date('2026-10-18T12:00:00Z');

const student = (id, name, email) => ({ id, full_name: name, email, role: 'student' });
const teacher = (id, name, email) => ({ id, full_name: name, email, role: 'teacher' });
const admin = (id, name, email) => ({ id, full_name: name, email, role: 'admin' });
const parent = (id, name, email) => ({ id, full_name: name, email, role: 'parent' });
const course = (id, name, teacherId) => ({ id, name, section: '4A', teacher_id: teacherId });
const task = (id, title, type, due, courseId) => ({ id, title, task_type: type, due_date: due, course_id: courseId });
const submission = (id, taskId, studentId, status, score, createdAt = null) => ({
  id, task_id: taskId, student_id: studentId, status, score, created_at: createdAt,
});

test('TDD-P01: examen vencido sin entregas obtiene prioridad crítica con motivos', () => {
  const classified = logic.classifyTask(
    task('t1', 'Examen final de Matemática', 'exam', '2026-10-17T12:00:00Z', 'c1'),
    [],
    NOW,
  );
  // Examen 30 + vencida 40 + sin entregar 15 = 85
  assert.equal(classified.score, 85);
  assert.equal(classified.level, 'critica');
  assert.equal(classified.isOverdue, true);
  assert.ok(classified.reasons.includes('Examen'));
  assert.ok(classified.reasons.some(reason => /Venció/.test(reason)));
  assert.ok(classified.reasons.includes('Sin entregas registradas'));
});

test('TDD-P02: tarea urgente con entrega por revisar queda en prioridad alta', () => {
  const classified = logic.classifyTask(
    task('t2', 'Práctica calificada', 'homework', '2026-10-19T00:00:00Z', 'c1'), // 12 h
    [submission('s1', 't2', 'st1', 'pending', null)],
    NOW,
  );
  // Tarea 20 + urgente 30 + pendiente 5 = 55
  assert.equal(classified.score, 55);
  assert.equal(classified.level, 'alta');
  assert.ok(classified.reasons.includes('Vence en 12 h'));
  assert.ok(classified.reasons.includes('1 entrega por revisar'));
});

test('TDD-P03: actividad lejana y totalmente revisada baja a prioridad baja', () => {
  const classified = logic.classifyTask(
    task('t3', 'Foro de lectura', 'forum', '2026-12-01T12:00:00Z', 'c1'),
    [submission('s2', 't3', 'st1', 'reviewed', 18)],
    NOW,
  );
  // Foro 10 + lejana 5 - revisadas 10 = 5
  assert.equal(classified.score, 5);
  assert.equal(classified.level, 'baja');
});

test('TDD-P04: la clasificación agrupa entregas por tarea y ordena por puntaje', () => {
  const tasks = [
    task('t1', 'Tarea con vencimiento lejano', 'homework', '2026-12-01T12:00:00Z', 'c1'),
    task('t2', 'Tarea vencida', 'homework', '2026-10-10T12:00:00Z', 'c1'),
  ];
  const submissions = [
    submission('s1', 't1', 'st1', 'reviewed', 15),
    submission('s2', 't2', 'st1', 'pending', null),
    submission('s3', 't2', 'st2', 'pending', null),
  ];
  const classified = logic.classifyTasks({ tasks, submissions, courses: [course('c1', 'Historia', 'pr1')] }, NOW);
  assert.equal(classified.length, 2);
  assert.equal(classified[0].taskId, 't2');
  assert.equal(classified[0].pendingReviews, 2);
  assert.equal(classified[0].courseName, 'Historia');
  assert.equal(classified[1].submissionState, 'reviewed');
});

test('TDD-P05: resumen de entregas por estudiante con niveles de riesgo', () => {
  const students = [
    student('st1', 'Mateo Rojas', 'mateo@escuela.edu'),
    student('st2', 'Ana Vega', 'ana@escuela.edu'),
    student('st3', 'Luis Sin Actividad', 'luis@escuela.edu'),
  ];
  const tasks = [
    task('t1', 'Vencida', 'homework', '2026-10-10T12:00:00Z', 'c1'),
    task('t2', 'Próxima', 'homework', '2026-10-30T12:00:00Z', 'c1'),
  ];
  const submissions = [
    submission('s1', 't1', 'st1', 'reviewed', 4),   // promedio bajo => en riesgo
    submission('s2', 't2', 'st1', 'pending', null),  // (ya no cuenta como vencida)
    submission('s3', 't1', 'st2', 'reviewed', 9),
    submission('s4', 't2', 'st2', 'pending', null),
  ];
  const memberships = [
    { course_id: 'c1', profile_id: 'st1' },
    { course_id: 'c1', profile_id: 'st2' },
    { course_id: 'c1', profile_id: 'st3' },
  ];
  const summaries = logic.buildDeliverySummary({ students, tasks, submissions, memberships }, NOW);
  const byId = Object.fromEntries(summaries.map(summary => [summary.studentId, summary]));

  assert.equal(byId.st1.assignedTasks, 2);
  assert.equal(byId.st1.submitted, 2);
  assert.equal(byId.st1.averageScore, 4);
  assert.equal(byId.st1.riskLevel, 'en_riesgo');

  assert.equal(byId.st2.pendingReview, 1);
  assert.equal(byId.st2.riskLevel, 'al_dia');

  assert.equal(byId.st3.submitted, 0);
  assert.equal(byId.st3.overdue, 1);
  assert.equal(byId.st3.riskLevel, 'sin_actividad');
});

test('TDD-P06: aviso de tarea próxima a vencer a estudiantes, docente y dirección', () => {
  const people = [
    student('st1', 'Mateo Rojas', 'mateo@escuela.edu'),
    student('st2', 'Ana Vega', 'ana@escuela.edu'),
    teacher('pr1', 'Prof. Ruiz', 'ruiz@escuela.edu'),
    admin('ad1', 'Dirección', 'direccion@escuela.edu'),
  ];
  const candidates = logic.buildAlertCandidates({
    tasks: [task('t1', 'Informe final', 'homework', '2026-10-19T12:00:00Z', 'c1')], // 24 h
    submissions: [submission('s1', 't1', 'st2', 'pending', null)],
    people,
    courses: [course('c1', 'Comunicación', 'pr1')],
    memberships: [
      { course_id: 'c1', profile_id: 'st1' },
      { course_id: 'c1', profile_id: 'st2' },
    ],
  }, NOW);

  const dueSoon = candidates.find(candidate => candidate.alertType === 'task_due_soon');
  assert.ok(dueSoon);
  assert.equal(dueSoon.severity, 'critica'); // 24 h => ventana urgente
  assert.equal(dueSoon.dedupeKey, 'due_soon:t1:2026-10-18');
  assert.deepEqual(dueSoon.metadata.studentIds, ['st1']);
  const audienceIds = dueSoon.audience.map(person => person.profileId).sort();
  assert.deepEqual(audienceIds, ['ad1', 'pr1', 'st1']);
  assert.match(dueSoon.message, /Vence en 24 h/);
});

test('TDD-P07: la alerta de tarea vencida no se duplica entre días distintos', () => {
  const input = {
    tasks: [task('t1', 'Ensayo histórico', 'essay', '2026-10-01T12:00:00Z', 'c1')],
    submissions: [],
    people: [student('st1', 'Mateo Rojas', 'mateo@escuela.edu'), admin('ad1', 'Dirección', 'direccion@escuela.edu')],
    courses: [course('c1', 'Historia', 'pr1')],
    memberships: [{ course_id: 'c1', profile_id: 'st1' }],
  };
  const first = logic.buildAlertCandidates(input, NOW);
  const later = logic.buildAlertCandidates(input, new Date('2026-10-25T12:00:00Z'));
  const overdueFirst = first.find(candidate => candidate.alertType === 'task_overdue');
  const overdueLater = later.find(candidate => candidate.alertType === 'task_overdue');
  assert.equal(overdueFirst.dedupeKey, 'overdue:t1');
  assert.equal(overdueLater.dedupeKey, 'overdue:t1');
});

test('TDD-P08: entregas sin calificar generan aviso al docente y a la dirección', () => {
  const people = [
    student('st1', 'Mateo Rojas', 'mateo@escuela.edu'),
    teacher('pr1', 'Prof. Ruiz', 'ruiz@escuela.edu'),
    admin('ad1', 'Dirección', 'direccion@escuela.edu'),
  ];
  const candidates = logic.buildAlertCandidates({
    tasks: [task('t1', 'Monografía', 'homework', '2026-10-30T12:00:00Z', 'c1')],
    submissions: [submission('s1', 't1', 'st1', 'pending', null, '2026-10-13T12:00:00Z')], // 5 días sin revisar
    people,
    courses: [course('c1', 'Comunicación', 'pr1')],
    memberships: [{ course_id: 'c1', profile_id: 'st1' }],
  }, NOW);

  const pendingReview = candidates.find(candidate => candidate.alertType === 'submission_pending_review');
  assert.ok(pendingReview);
  assert.equal(pendingReview.severity, 'media');
  assert.equal(pendingReview.dedupeKey, 'pending_review:c1:2026-10-18');
  assert.deepEqual(pendingReview.metadata.submissionIds, ['s1']);
  assert.deepEqual(pendingReview.audience.map(person => person.profileId).sort(), ['ad1', 'pr1']);
});

test('TDD-P09: estudiante con promedio bajo genera alerta para docentes y padres, y resumen semanal de dirección', () => {
  const people = [
    student('st1', 'Mateo Rojas', 'mateo@escuela.edu'),
    teacher('pr1', 'Prof. Ruiz', 'ruiz@escuela.edu'),
    admin('ad1', 'Dirección', 'direccion@escuela.edu'),
    parent('pa1', 'Rosa Rojas', 'rosa.rojas@casa.edu'),
  ];
  const candidates = logic.buildAlertCandidates({
    tasks: [task('t1', 'Álgebra', 'homework', '2026-10-30T12:00:00Z', 'c1')],
    submissions: [submission('s1', 't1', 'st1', 'reviewed', 3)],
    people,
    courses: [course('c1', 'Matemática', 'pr1')],
    memberships: [{ course_id: 'c1', profile_id: 'st1' }],
    parentLinks: [{ parent_profile_id: 'pa1', student_profile_id: 'st1' }],
  }, NOW);

  const atRisk = candidates.find(candidate => candidate.alertType === 'student_at_risk');
  assert.ok(atRisk);
  assert.equal(atRisk.severity, 'alta');
  assert.equal(atRisk.dedupeKey, `at_risk:st1:${logic.weekKey(NOW)}`);
  // Solo el docente del aula y el padre vinculado reciben el correo.
  assert.deepEqual(atRisk.audience.map(person => person.profileId).sort(), ['pa1', 'pr1']);

  const weekly = candidates.find(candidate => candidate.alertType === 'weekly_summary');
  assert.ok(weekly);
  assert.deepEqual(weekly.audience.map(person => person.profileId), ['ad1']);
  assert.match(weekly.message, /1 estudiantes en riesgo/);
});

test('TDD-P10: claves de día y semana ISO estables para el control de duplicados', () => {
  assert.equal(logic.dayKey(NOW), '2026-10-18');
  assert.equal(logic.weekKey(NOW), '2026-W42');
  assert.equal(logic.weekKey(new Date('2026-01-01T12:00:00Z')), '2026-W01');
  assert.equal(logic.weekKey(new Date('2025-12-29T12:00:00Z')), '2026-W01');
});

test('TDD-P11: métricas del componente inteligente', () => {
  const tasks = [
    task('t1', 'Vencida', 'exam', '2026-10-01T12:00:00Z', 'c1'),
    task('t2', 'Próxima', 'homework', '2026-10-19T12:00:00Z', 'c1'),
  ];
  const submissions = [submission('s1', 't2', 'st1', 'reviewed', 4)];
  const classified = logic.classifyTasks({ tasks, submissions }, NOW);
  const summaries = logic.buildDeliverySummary({
    students: [student('st1', 'Mateo Rojas', 'mateo@escuela.edu')],
    tasks,
    submissions,
    memberships: [{ course_id: 'c1', profile_id: 'st1' }],
  }, NOW);
  const metrics = logic.buildSmartMetrics(classified, summaries, NOW);
  assert.equal(metrics.totalTasks, 2);
  assert.equal(metrics.overdue, 1);
  assert.equal(metrics.dueSoon, 1);
  assert.equal(metrics.atRisk, 1);
  assert.equal(metrics.averageScore, 4);
});

test('TDD-P12: validar la configuración Gmail con contraseña de aplicación', () => {
  const valid = logic.validateEmailSettingsInput({
    enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_security: 'tls',
    smtp_user: 'notificaciones@instituto.edu.pe',
    from_email: 'notificaciones@instituto.edu.pe',
    from_name: 'InfoTarea',
    smtp_password: 'abcd efgh ijkl mnop',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.passwordAction, 'set');
  assert.equal(valid.password, 'abcdefghijklmnop');
  assert.equal(valid.settings.smtp_port, 587);

  const badPort = logic.validateEmailSettingsInput({
    enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 0,
    smtp_security: 'tls',
    from_email: 'notificaciones@instituto.edu.pe',
  });
  assert.equal(badPort.valid, false);
  assert.ok(badPort.errors.some(error => /puerto SMTP/i.test(error)));

  const gmailMismatch = logic.validateEmailSettingsInput({
    enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    smtp_security: 'tls',
    from_email: 'notificaciones@instituto.edu.pe',
  });
  assert.equal(gmailMismatch.valid, false);
  assert.ok(gmailMismatch.errors.some(error => /587/.test(error)));

  const missingFrom = logic.validateEmailSettingsInput({
    enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_security: 'tls',
  });
  assert.equal(missingFrom.valid, false);
  assert.ok(missingFrom.errors.some(error => /correo remitente/i.test(error)));

  const clear = logic.validateEmailSettingsInput({
    enabled: false,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_security: 'tls',
    clear_password: true,
  });
  assert.equal(clear.valid, true);
  assert.equal(clear.passwordAction, 'clear');

  const generic = logic.validateEmailSettingsInput({
    enabled: true,
    smtp_host: 'mail.instituto.edu.pe',
    smtp_port: 25,
    smtp_security: 'none',
    from_email: 'notificaciones@instituto.edu.pe',
  });
  assert.equal(generic.valid, true);
});

test('TDD-P13: opciones del transporte SMTP según la seguridad elegida', () => {
  const tls = logic.smtpTransportOptions({
    smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_security: 'tls', smtp_user: 'notificaciones@instituto.edu.pe',
  }, 'clave-de-aplicacion');
  assert.equal(tls.secure, false);
  assert.equal(tls.requireTLS, true);
  assert.deepEqual(tls.auth, { user: 'notificaciones@instituto.edu.pe', pass: 'clave-de-aplicacion' });

  const ssl = logic.smtpTransportOptions({
    smtp_host: 'smtp.gmail.com', smtp_port: 465, smtp_security: 'ssl', smtp_user: 'notificaciones@instituto.edu.pe',
  }, 'clave-de-aplicacion');
  assert.equal(ssl.secure, true);
  assert.equal(ssl.requireTLS, false);

  const noAuth = logic.smtpTransportOptions({
    smtp_host: 'mail.instituto.edu.pe', smtp_port: 25, smtp_security: 'none', smtp_user: null,
  }, null);
  assert.equal(noAuth.auth, null);

  assert.equal(logic.isSmtpConfigured({
    enabled: true, smtp_host: 'smtp.gmail.com', smtp_port: 587, from_email: 'a@b.com', smtp_user: 'a@b.com',
  }, false), false);
  assert.equal(logic.isSmtpConfigured({
    enabled: true, smtp_host: 'smtp.gmail.com', smtp_port: 587, from_email: 'a@b.com', smtp_user: 'a@b.com',
  }, true), true);
});

test('TDD-P14: los correos se agrupan por destinatario y priorizan la severidad', () => {
  const candidates = [
    {
      alertType: 'task_due_soon', severity: 'alta', title: 'Tarea por vencer: A', message: 'Vence pronto',
      dedupeKey: 'due_soon:A:2026-10-18', audience: [{ role: 'student', profileId: 'st1', email: 'mateo@escuela.edu' }],
    },
    {
      alertType: 'task_overdue', severity: 'critica', title: 'Tarea vencida: B', message: 'No entregó',
      dedupeKey: 'overdue:B', audience: [{ role: 'student', profileId: 'st1', email: 'mateo@escuela.edu' }],
    },
    {
      alertType: 'weekly_summary', severity: 'informativa', title: 'Resumen', message: 'Semanal',
      dedupeKey: 'weekly:2026-W42', audience: [{ role: 'admin', profileId: 'ad1', email: 'direccion@escuela.edu' }],
    },
  ];
  const digests = logic.buildEmailDigests(candidates);
  const studentDigest = digests.find(digest => digest.to === 'mateo@escuela.edu');
  assert.equal(studentDigest.alerts.length, 2);
  assert.equal(studentDigest.alerts[0].severity, 'critica');
  assert.match(studentDigest.subject, /2 alertas/);

  const adminDigest = digests.find(digest => digest.to === 'direccion@escuela.edu');
  assert.match(adminDigest.subject, /Resumen/);
});

test('TDD-P15: normalización de ajustes y reglas persistidas', () => {
  const settings = logic.normalizeStoredEmailSettings({
    enabled: true,
    smtp_host: 'SMTP.GMAIL.COM',
    smtp_port: '465',
    smtp_security: 'ssl',
    alert_config: { task_due_soon: false },
  });
  assert.equal(settings.smtp_host, 'SMTP.GMAIL.COM');
  assert.equal(settings.smtp_port, 465);
  assert.equal(settings.smtp_security, 'ssl');
  assert.equal(settings.alert_config.task_due_soon, false);
  assert.equal(settings.alert_config.student_at_risk, true);

  const defaults = logic.normalizeStoredEmailSettings(null);
  assert.equal(defaults.smtp_host, 'smtp.gmail.com');
  assert.equal(defaults.smtp_port, 587);
  assert.equal(defaults.enabled, false);

  const merged = logic.mergeAlertRules([
    { rule_key: 'task_due_soon', enabled: false, config: { hours: 72 } },
    { rule_key: 'student_at_risk', enabled: true, config: { average: 6, overdue: 3 } },
  ]);
  assert.equal(merged.rules.dueSoonHours, 72);
  assert.equal(merged.rules.atRiskAverage, 6);
  assert.equal(merged.rules.overdueLimitForRisk, 3);
  assert.equal(merged.enabledTypes.task_due_soon, false);
  assert.equal(merged.enabledTypes.submission_pending_review, true);
});

test('TDD-P16: el correo de bajo rendimiento llega solo a docentes y padres, con el nombre del estudiante', () => {
  const people = [
    student('st1', 'Mateo Rojas', 'mateo@escuela.edu'),
    teacher('pr1', 'Prof. Ruiz', 'ruiz@escuela.edu'),
    admin('ad1', 'Dirección', 'direccion@escuela.edu'),
    parent('pa1', 'Rosa Rojas', 'rosa.rojas@casa.edu'),
  ];
  const candidates = logic.buildAlertCandidates({
    tasks: [task('t1', 'Álgebra', 'homework', '2026-10-30T12:00:00Z', 'c1')],
    submissions: [submission('s1', 't1', 'st1', 'reviewed', 3)],
    people,
    courses: [course('c1', 'Matemática', 'pr1')],
    memberships: [{ course_id: 'c1', profile_id: 'st1' }],
    parentLinks: [{ parent_profile_id: 'pa1', student_profile_id: 'st1' }],
  }, NOW);

  const atRisk = candidates.find(candidate => candidate.alertType === 'student_at_risk');
  assert.ok(atRisk);

  // La audiencia del correo incluye solo a docentes y padres; el nombre del
  // estudiante viaja en el título (y por tanto en el asunto) para que el padre
  // reconozca a su hijo.
  assert.match(atRisk.title, /Mateo Rojas/);
  assert.deepEqual(atRisk.audience.map(person => person.role).sort(), ['parent', 'teacher']);
  assert.deepEqual(atRisk.audience.map(person => person.profileId).sort(), ['pa1', 'pr1']);

  // Dentro del sistema el aviso sigue asociado al estudiante (student_id + RLS):
  // la vista del alumno lo muestra en segunda persona.
  assert.equal(atRisk.studentId, 'st1');
  assert.equal(logic.studentAlertTitle(atRisk.alertType, atRisk.title), 'Tu rendimiento requiere atención');

  // Los correos: docente y padre reciben la alerta con el nombre; el estudiante
  // no recibe correo y la dirección solo recibe su resumen semanal.
  const digests = logic.buildEmailDigests(candidates);
  assert.deepEqual(digests.map(digest => digest.to).sort(), [
    'direccion@escuela.edu',
    'rosa.rojas@casa.edu',
    'ruiz@escuela.edu',
  ]);
  assert.equal(digests.some(digest => digest.to === 'mateo@escuela.edu'), false);
  const parentDigest = digests.find(digest => digest.to === 'rosa.rojas@casa.edu');
  assert.equal(parentDigest.role, 'parent');
  assert.equal(parentDigest.alerts.some(alert => alert.alertType === 'student_at_risk'), true);
  assert.match(parentDigest.subject, /Mateo Rojas/);
  const adminDigest = digests.find(digest => digest.to === 'direccion@escuela.edu');
  assert.deepEqual(adminDigest.alerts.map(alert => alert.alertType), ['weekly_summary']);

  // Si el alumno no tiene padres vinculados, el aviso igual llega a sus docentes.
  const sinPadres = logic.buildAlertCandidates({
    tasks: [task('t1', 'Álgebra', 'homework', '2026-10-30T12:00:00Z', 'c1')],
    submissions: [submission('s2', 't1', 'st2', 'reviewed', 2)],
    people: [student('st2', 'Ana Vega', null), teacher('pr1', 'Prof. Ruiz', 'ruiz@escuela.edu')],
    courses: [course('c1', 'Matemática', 'pr1')],
    memberships: [{ course_id: 'c1', profile_id: 'st2' }],
  }, NOW);
  const digestsSinPadres = logic.buildEmailDigests(sinPadres);
  assert.deepEqual(digestsSinPadres.map(digest => digest.to), ['ruiz@escuela.edu']);
});
