import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const realRequire = createRequire(import.meta.url);
const me = 'aaaaaaaa-1111-4111-8111-111111111111';
const other = 'bbbbbbbb-2222-4222-8222-222222222222';
const messageId = 'cccccccc-3333-4333-8333-333333333333';

function loadModule(relative, client, overrides = {}) {
  const path = new URL(relative, import.meta.url);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path.pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loadedModule = { exports: {} };
  const require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === '@/lib/supabase/server' ? { createClient: async () => client }
    : name === '@/shared/utils/communication' ? loadModule('../../src/shared/utils/communication.ts', client)
    : realRequire(name);
  new Function('module', 'exports', 'require', output)(loadedModule, loadedModule.exports, require);
  return loadedModule.exports;
}

// The external database boundary is replaced by a small in-memory store. The
// handlers, Request/Response, validation, identity and query scope are real.
function clientFor({ user = { id: me }, rows = [], failure = null } = {}) {
  const store = structuredClone(rows);
  const client = { auth: { getUser: async () => ({ data: { user } }) }, store, reads: 0,
    from() {
      client.reads++;
      const filters = [];
      let action = 'select';
      let values = {};
      let maxRows = Infinity;
      const ordering = [];
      const query = {
        select() { return query; },
        order(field, { ascending = true } = {}) { ordering.push({ field, ascending }); return query; },
        limit(count) { maxRows = count; return query; },
        eq(field, value) { filters.push(row => row[field] === value); return query; },
        gt(field, value) { filters.push(row => row[field] > value); return query; },
        or() { return query; },
        update(data) { action = 'update'; values = data; return query; },
        insert(data) { action = 'insert'; values = data; return query; },
        upsert(data) { action = 'insert'; values = data; return query; },
        delete() { action = 'delete'; return query; },
        async maybeSingle() {
          if (failure) return { data: null, error: failure };
          const index = store.findIndex(row => filters.every(filter => filter(row)));
          if (index < 0) return { data: null, error: null };
          if (action === 'update') Object.assign(store[index], values);
          const result = structuredClone(store[index]);
          if (action === 'delete') store.splice(index, 1);
          return { data: result, error: null };
        },
        async single() {
          if (failure) return { data: null, error: failure };
          const result = { id: messageId, ...values };
          if (store.some(row => row.id === result.id)) return { data: null, error: { code: '23505' } };
          store.push(result);
          return { data: result, error: null };
        },
        then(resolve, reject) {
          if (failure) return Promise.resolve({ data: null, error: failure }).then(resolve, reject);
          const matching = store.filter(row => filters.every(filter => filter(row)));
          if (action === 'delete') for (const row of matching) store.splice(store.indexOf(row), 1);
          if (action === 'insert') store.push({ ...values });
          matching.sort((a, b) => {
            for (const { field, ascending } of ordering) {
              if (a[field] !== b[field]) return (a[field] < b[field] ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
          return Promise.resolve({ data: matching.slice(0, maxRows), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return client;
}

const route = client => loadModule('../../src/app/api/communication/messages/route.ts', client);
const request = (method, body) => new Request('http://localhost/api/communication/messages', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

test('todos los métodos de mensajes exigen sesión', async () => {
  const client = clientFor({ user: null });
  const handlers = route(client);
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    const response = await handlers[method](method === 'GET' ? new Request('http://localhost/api/communication/messages') : request(method, { id: messageId, content: 'hola' }));
    assert.equal(response.status, 401);
  }
  assert.equal(client.reads, 0);
});

test('editar y eliminar mensajes ajenos devuelve 404 y conserva sus datos', async () => {
  const client = clientFor({ rows: [{ id: messageId, sender_id: other, content: 'original' }] });
  const handlers = route(client);
  assert.equal((await handlers.PATCH(request('PATCH', { id: messageId, sender_id: me, content: 'intrusión' }))).status, 404);
  assert.equal((await handlers.DELETE(request('DELETE', { id: messageId, sender_id: me }))).status, 404);
  assert.deepEqual(client.store, [{ id: messageId, sender_id: other, content: 'original' }]);
});

test('edita únicamente el contenido de un mensaje propio y permite eliminarlo', async () => {
  const client = clientFor({ rows: [{ id: messageId, sender_id: me, receiver_id: other, channel_type: 'teacher_student', content: 'original' }] });
  const handlers = route(client);
  const response = await handlers.PATCH(request('PATCH', { id: messageId, receiver_id: me, channel_type: 'admin_teacher', content: ' corregido ' }));
  assert.equal(response.status, 200);
  assert.equal(client.store[0].content, 'corregido');
  assert.equal(client.store[0].receiver_id, other);
  assert.equal(client.store[0].channel_type, 'teacher_student');
  assert.equal((await handlers.DELETE(request('DELETE', { id: messageId }))).status, 200);
  assert.deepEqual(client.store, []);
});

test('rechaza contenido inválido e identificadores manipulados antes de consultar datos', async () => {
  const client = clientFor();
  const handlers = route(client);
  for (const content of [{}, '', ' ', 'x'.repeat(4001)]) assert.equal((await handlers.PATCH(request('PATCH', { id: messageId, content }))).status, 400);
  assert.equal((await handlers.GET(new Request('http://localhost/api/communication/messages?other_user_id=x),sender_id.neq.other'))).status, 400);
  assert.equal((await handlers.POST(request('POST', { receiverId: other, channelType: 'inventado', content: 'hola' }))).status, 400);
  assert.equal(client.reads, 0);
});

test('el remitente procede de la sesión y un error de permisos no aparenta éxito', async () => {
  const client = clientFor();
  const response = await route(client).POST(request('POST', { receiverId: other, channelType: 'teacher_student', content: 'hola', sender_id: other }));
  assert.equal(response.status, 201);
  assert.equal(client.store[0].sender_id, me);
  const forbidden = route(clientFor({ failure: { code: '42501' } }));
  assert.equal((await forbidden.POST(request('POST', { receiverId: other, channelType: 'teacher_student', content: 'hola' }))).status, 403);
  assert.equal((await forbidden.GET(new Request('http://localhost/api/communication/messages'))).status, 403);
});

test('presencia devuelve solo sesiones recientes y no revela estados si falla la tabla', async () => {
  const now = Date.now();
  const client = clientFor({ rows: [
    { user_id: me, last_seen: new Date(now - 10_000).toISOString() },
    { user_id: me, last_seen: new Date(now - 5_000).toISOString() },
    { user_id: other, last_seen: new Date(now - 60_000).toISOString() },
  ] });
  const handlers = loadModule('../../src/app/api/communication/presence/route.ts', client);
  const response = await handlers.GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).onlineIds, [me]);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const broken = loadModule('../../src/app/api/communication/presence/route.ts', clientFor({ failure: { code: '42P01' } }));
  assert.equal((await broken.GET()).status, 503);
});

test('cada pestaña elimina únicamente su propia sesión de presencia', async () => {
  const sessionId = 'dddddddd-4444-4444-8444-444444444444';
  const secondSession = 'eeeeeeee-5555-4555-8555-555555555555';
  const client = clientFor({ rows: [{ user_id: me, session_id: sessionId }, { user_id: me, session_id: secondSession }, { user_id: other, session_id: sessionId }] });
  const handlers = loadModule('../../src/app/api/communication/presence/route.ts', client);
  assert.equal((await handlers.DELETE(request('DELETE', { sessionId, user_id: other }))).status, 200);
  assert.deepEqual(client.store, [{ user_id: me, session_id: secondSession }, { user_id: other, session_id: sessionId }]);
});

test('un reintento con el mismo identificador no duplica un envío ya confirmado por la base', async () => {
  const client = clientFor();
  const handlers = route(client);
  const body = { messageId, receiverId: other, channelType: 'teacher_student', content: 'hola' };
  assert.equal((await handlers.POST(request('POST', body))).status, 201);
  const retry = await handlers.POST(request('POST', body));
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).message.id, messageId);
  assert.equal(client.store.length, 1);
});

test('las conversaciones largas devuelven la página más reciente y anuncian historial anterior', async () => {
  const rows = Array.from({ length: 150 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    sender_id: me, receiver_id: other, channel_type: 'teacher_student', content: String(index),
    created_at: new Date(Date.UTC(2026, 9, 17, 12, 0, index)).toISOString(),
  }));
  const handlers = route(clientFor({ rows }));
  const response = await handlers.GET(new Request(`http://localhost/api/communication/messages?other_user_id=${other}`));
  const data = await response.json();
  assert.equal(data.messages.length, 100);
  assert.equal(data.messages[0].content, '50');
  assert.equal(data.messages.at(-1).content, '149');
  assert.equal(data.hasMore, true);
  assert.deepEqual(data.nextCursor, { createdAt: rows[50].created_at, id: rows[50].id });
});

function familyClientFor({ schemaReady = false, verifiedAt = null, linkError = null, missingCode = '42703' } = {}) {
  const calls = [];
  const client = {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: me } } }) },
    from(table) {
      const call = { table, columns: '', filters: [] };
      calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return query; },
        eq(field, value) { call.filters.push([field, value]); return query; },
        in(field, values) { call.filters.push([field, values]); return query; },
        order() { return query; },
        async single() { return { data: { role: 'parent' }, error: null }; },
        then(resolve, reject) {
          let result;
          if (table === 'parent_children') {
            result = linkError ? { data: null, error: linkError }
              : !schemaReady && call.columns.includes('verified_at') ? { data: null, error: { code: missingCode, message: 'column parent_children.verified_at does not exist' } }
              : { data: [{ id: messageId, parent_profile_id: me, student_profile_id: other, linked_at: '2026-10-17T12:00:00Z', ...(schemaReady ? { verified_at: verifiedAt } : {}) }], error: null };
          } else if (table === 'profiles') {
            result = { data: [{ id: other, full_name: 'Estudiante', email: 'student@example.test', avatar_url: null, course_members: [{ course_id: 'math', courses: { id: 'math', name: 'Matemática', section: '2B', teacher_id: 'teacher', teacher: { id: 'teacher', full_name: 'Docente' } } }] }], error: null };
          } else { result = { data: [], error: null }; }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return client;
}

test('el panel familiar carga los vínculos cuando verified_at aún no existe', async () => {
  for (const missingCode of ['42703', 'PGRST204']) {
    const client = familyClientFor({ missingCode });
    const handlers = loadModule('../../src/app/api/parents/children/route.ts', client);
    const response = await handlers.GET(new Request('http://localhost/api/parents/children'));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.children[0].id, other);
    assert.equal(data.verificationAvailable, false);
    assert.equal(data.children[0].verificationPending, true);
    assert.equal(data.children[0].grade, null);
    assert.deepEqual(data.children[0].courses, []);
    assert.deepEqual(data.children[0].teachers, []);
    assert.match(data.notice, /activar/i);
    assert.equal(client.calls.filter(call => call.table === 'parent_children').length, 2);
    assert.equal(client.calls.some(call => call.table === 'submissions' || call.table === 'tasks'), false);
    for (const call of client.calls.filter(call => call.table === 'parent_children')) assert.ok(call.filters.some(([field, value]) => field === 'parent_profile_id' && value === me));
  }
});

test('un vínculo verificado conserva grado, sección y docente con el esquema actualizado', async () => {
  const client = familyClientFor({ schemaReady: true, verifiedAt: '2026-10-17T12:00:00Z' });
  const response = await loadModule('../../src/app/api/parents/children/route.ts', client).GET(new Request('http://localhost/api/parents/children'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.verificationAvailable, true);
  assert.equal(data.children[0].grade, '2');
  assert.equal(data.children[0].section, '2B');
  assert.equal(data.children[0].teachers[0].full_name, 'Docente');
  assert.equal(data.children[0].verificationPending, false);
  assert.equal(client.calls.filter(call => call.table === 'parent_children').length, 1);
});

test('los fallos de permisos y otras columnas no se ocultan con una consulta de respaldo', async () => {
  for (const linkError of [
    { code: '42501', message: 'permission denied for parent_children' },
    { code: '42P01', message: 'relation parent_children does not exist' },
    { code: '42703', message: 'column parent_children.linked_at does not exist' },
  ]) {
    const client = familyClientFor({ linkError });
    const response = await loadModule('../../src/app/api/parents/children/route.ts', client).GET(new Request('http://localhost/api/parents/children'));
    assert.equal(response.status, 500);
    assert.equal(client.calls.filter(call => call.table === 'parent_children').length, 1);
  }
});

test('la limpieza del panel familiar cancela la consulta sin error de consola ni cambios de estado', async () => {
  const actualReact = realRequire('react');
  let effect;
  const updates = [];
  const logs = [];
  const redirects = [];
  const overrides = {
    react: { ...actualReact, default: actualReact,
      useState: initial => [typeof initial === 'function' ? initial() : initial, value => updates.push(value)],
      useEffect: callback => { effect = callback; },
    },
    'next/navigation': { useRouter: () => ({ push: value => redirects.push(value) }) },
    'next/link': { default: () => null },
    '@/modules/parent/components/ParentLayout': { ParentLayout: () => null },
  };
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  console.error = (...args) => logs.push(args);
  try {
    const Page = loadModule('../../src/app/parent/dashboard/page.tsx', null, overrides).default;
    Page();
    const cleanup = effect();
    cleanup();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(logs, []);
    assert.deepEqual(updates, []);
    assert.deepEqual(redirects, []);
    // Strict Mode mounts the effect again after its development cleanup.
    globalThis.fetch = async () => Response.json({ children: [] });
    const nextCleanup = effect();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(logs, []);
    assert.deepEqual(redirects, ['/parent/onboarding']);
    assert.ok(updates.length > 0);
    nextCleanup();
  } finally { globalThis.fetch = originalFetch; console.error = originalConsoleError; }
});
