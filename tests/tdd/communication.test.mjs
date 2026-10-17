import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = new URL('../../src/shared/utils/communication.ts', import.meta.url);
const logic = existsSync(source)
  ? await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(readFileSync(source, 'utf8'))).toString('base64'))
  : {};
const fn = (name) => { assert.equal(typeof logic[name], 'function', `${name} debe existir`); return logic[name]; };

test('solo sesiones recientes y no futuras cuentan como conectadas', () => {
  const online = fn('activePresenceIds');
  const now = Date.parse('2026-10-17T12:00:00Z');
  assert.deepEqual(online([
    { user_id: 'teacher', last_seen: '2026-10-17T11:59:55Z' },
    { user_id: 'student', last_seen: '2026-10-17T11:59:00Z' },
    { user_id: 'parent', last_seen: 'invalid' },
    { user_id: 'future', last_seen: '2026-10-17T12:01:00Z' },
  ], now), ['teacher']);
});

test('una segunda pestaña activa mantiene al usuario conectado sin duplicarlo', () => {
  const online = fn('activePresenceIds');
  const now = Date.parse('2026-10-17T12:00:00Z');
  assert.deepEqual(online([
    { user_id: 'teacher', last_seen: '2026-10-17T11:59:00Z' },
    { user_id: 'teacher', last_seen: '2026-10-17T11:59:50Z' },
    { user_id: 'teacher', last_seen: '2026-10-17T11:59:55Z' },
  ], now), ['teacher']);
});

test('interpreta grado y sección almacenados sin inventar datos faltantes', () => {
  const classroom = fn('describeClassroom');
  assert.deepEqual(classroom('2B'), { grade: '2', section: 'B', label: 'Grado 2 · Sección B' });
  assert.deepEqual(classroom(' 3° A '), { grade: '3', section: 'A', label: 'Grado 3 · Sección A' });
  assert.deepEqual(classroom(null), { grade: null, section: null, label: 'Sin aula asignada' });
  assert.deepEqual(classroom('B'), { grade: null, section: 'B', label: 'Sección B' });
});

test('la ficha familiar conserva todas las aulas y relaciona cada docente con su curso', () => {
  const info = fn('childAcademicInfo')({ course_members: [
    { courses: { id: 'math', name: 'Matemática', section: '2B', teacher: { id: 't1', full_name: 'Docente Uno' } } },
    { courses: { id: 'science', name: 'Ciencia', section: '2B', teacher: { id: 't2', full_name: 'Docente Dos' } } },
    { courses: { id: 'art', name: 'Arte', section: '3A', teacher: null } },
    { courses: null },
  ] });
  assert.deepEqual(info.classrooms.map(c => c.label), ['Grado 2 · Sección B', 'Grado 3 · Sección A']);
  assert.deepEqual(info.teachers.map(t => [t.id, t.courseName, t.section]), [['t1', 'Matemática', '2B'], ['t2', 'Ciencia', '2B']]);
  assert.equal(fn('childAcademicInfo')({ course_members: [] }).section, null);
});

test('solo el remitente puede modificar un mensaje persistido', () => {
  const canChange = fn('canModifyMessage');
  assert.equal(canChange({ id: 'real', sender_id: 'me' }, 'me'), true);
  assert.equal(canChange({ id: 'real', sender_id: 'other' }, 'me'), false);
  assert.equal(canChange({ id: 'tmp-1', sender_id: 'me' }, 'me'), false);
  assert.equal(canChange({ id: 'real', sender_id: 'me' }, ''), false);
});

test('rechaza mensajes vacíos, de tipo incorrecto o excesivamente largos', () => {
  const content = fn('validatedMessageContent');
  assert.equal(content(' hola '), 'hola');
  for (const value of [null, {}, '', '  ', 'x'.repeat(4001)]) assert.equal(content(value), null);
});

test('la respuesta de envío y el evento realtime no duplican el mensaje', () => {
  const merge = fn('mergeChatMessage');
  const pending = { id: 'tmp-1', sender_id: 'me', content: 'hola' };
  const saved = { id: 'real', sender_id: 'me', content: 'hola' };
  assert.deepEqual(merge([pending, saved], saved, 'tmp-1'), [saved]);
  assert.deepEqual(merge([saved], { ...saved, content: 'corregido' }), [{ ...saved, content: 'corregido' }]);
});

test('valida UUID antes de incluir identificadores en filtros de la API', () => {
  const valid = fn('isUuid');
  assert.equal(valid('baadbeef-1111-4222-8333-0123456789ab'), true);
  assert.equal(valid('x),sender_id.neq.other'), false);
  assert.equal(valid(null), false);
});

test('los estados en línea caducan localmente si la siguiente consulta queda sin respuesta', () => {
  const snapshotIds = fn('presenceSnapshotIds');
  const snapshot = { receivedAt: 1000, serverTime: Date.parse('2026-10-17T12:00:00Z'), sessions: [{ user_id: 'teacher', last_seen: '2026-10-17T11:59:50Z' }] };
  assert.deepEqual(snapshotIds(snapshot, 1000), ['teacher']);
  assert.deepEqual(snapshotIds(snapshot, 40_000), []);
  assert.equal(snapshotIds(snapshot, 50_000), null);
});

test('una petición sin respuesta agota su plazo y permite la siguiente', async () => {
  const requestJson = fn('requestCommunicationJson');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true }));
  try { await assert.rejects(requestJson('/test', {}, 10), /timeout|Abort|tiempo/i); }
  finally { globalThis.fetch = originalFetch; }
  const result = await requestJson('data:application/json,%7B%22ok%22%3Atrue%7D');
  assert.equal(result.data.ok, true);
});

test('los vínculos familiares pendientes no habilitan datos académicos', () => {
  const verified = fn('verifiedChildIds');
  assert.deepEqual(verified([
    { student_profile_id: 'a', verified_at: null },
    { student_profile_id: 'b', verified_at: '2026-10-17T12:00:00Z' },
    { student_profile_id: 'c', verified_at: 'invalid' },
  ]), ['b']);
});

test('el cursor conserva la precisión de microsegundos y rechaza filtros inyectados', () => {
  const parse = fn('parseHistoryCursor');
  const id = 'baadbeef-1111-4222-8333-0123456789ab';
  assert.deepEqual(parse('2026-10-17T12:00:00.123456+00:00', id), { createdAt: '2026-10-17T12:00:00.123456+00:00', id });
  assert.equal(parse('2026-10-17T12:00:00Z),sender_id.neq.x', id), null);
  assert.equal(parse('no-date', id), null);
});

test('la cancelación del componente conserva su motivo y no se confunde con el plazo', async () => {
  const requestJson = fn('requestCommunicationJson');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason);
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  try {
    const controller = new AbortController();
    const reason = new DOMException('Navegación a otra pantalla', 'AbortError');
    const pending = requestJson('/test', { signal: controller.signal });
    controller.abort(reason);
    await assert.rejects(pending, error => error === reason);
    await assert.rejects(requestJson('/test', {}, 10), error => error.name === 'TimeoutError' && /tiempo/i.test(error.message));
  } finally { globalThis.fetch = originalFetch; }
});
