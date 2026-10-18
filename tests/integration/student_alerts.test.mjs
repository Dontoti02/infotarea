import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS DE INTEGRACIÓN - ITERACIÓN Nº 4 (aviso al estudiante)
 *
 * `loadStudentAlerts` de `src/modules/smart/services/smartService.ts`:
 * el estudiante recibe dentro del sistema sus propios avisos (por ejemplo,
 * bajo rendimiento detectado por el componente inteligente). La política de
 * RLS «Estudiantes ven sus propias alertas» respalda el filtro, y la interfaz
 * debe sobrevivir cuando la migración aún no está aplicada.
 *
 * Solo se reemplaza el cliente de Supabase; la consulta y el manejo de
 * errores son los reales.
 */

const realRequire = createRequire(import.meta.url);
const sharedCache = new Map();

function loadShared(name) {
  const key = `shared:${name}`;
  if (!sharedCache.has(key)) {
    sharedCache.set(key, loadModule(`../../src/shared/utils/${name}.ts`));
  }
  return sharedCache.get(key);
}

function loadModule(relative, overrides = {}) {
  const path = new URL(relative, import.meta.url);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path.pathname,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  const require = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === '@/shared/utils/prioritization' || name === './prioritization') return loadShared('prioritization');
    return realRequire(name);
  };
  new Function('module', 'exports', 'require', output)(loadedModule, loadedModule.exports, require);
  return loadedModule.exports;
}

/** Cliente falso que registra la consulta y devuelve filas o error. */
function fakeClient({ rows = [], error = null } = {}) {
  const calls = { table: null, columns: null, filters: [], order: null, limit: null };
  const builder = {
    select(columns) {
      calls.columns = columns;
      return builder;
    },
    eq(column, value) {
      calls.filters.push([column, value]);
      return builder;
    },
    order(column, options) {
      calls.order = { column, options };
      return builder;
    },
    limit(size) {
      calls.limit = size;
      return Promise.resolve({ data: rows, error });
    },
  };
  return {
    calls,
    client: {
      from(table) {
        calls.table = table;
        return builder;
      },
    },
  };
}

function loadSmartService(client) {
  return loadModule('../../src/modules/smart/services/smartService.ts', {
    '@/lib/supabase/client': { createClient: () => client },
  });
}

const ALERT_ROW = {
  id: 'alert-1',
  alert_type: 'student_at_risk',
  severity: 'alta',
  title: 'Estudiante en riesgo: Ana Vega',
  message: 'Promedio 3 · 2 vencidas · 1 sin entregar. Requiere seguimiento.',
  student_id: 'st-1',
  task_id: null,
  course_id: null,
  metadata: { averageScore: 3 },
  dedupe_key: 'at_risk:st-1:2026-W42',
  status: 'sent',
  email_status: 'sent',
  sent_at: '2026-10-18T12:00:00Z',
  created_at: '2026-10-18T12:00:00Z',
};

test('el estudiante recibe sus alertas filtradas por su propio identificador y ordenadas por fecha', async () => {
  const fake = fakeClient({ rows: [ALERT_ROW] });
  const { loadStudentAlerts, STUDENT_ALERT_LIMIT } = loadSmartService(fake.client);

  const alerts = await loadStudentAlerts({ userId: 'st-1', client: fake.client });

  assert.deepEqual(alerts, [ALERT_ROW]);
  assert.equal(fake.calls.table, 'smart_alerts');
  assert.deepEqual(fake.calls.filters, [['student_id', 'st-1']]);
  assert.deepEqual(fake.calls.order, { column: 'created_at', options: { ascending: false } });
  assert.equal(fake.calls.limit, STUDENT_ALERT_LIMIT);
  assert.match(fake.calls.columns, /alert_type/);
  assert.match(fake.calls.columns, /email_status/);
});

test('el límite de avisos del tablero es configurable', async () => {
  const fake = fakeClient({ rows: [] });
  const { loadStudentAlerts } = loadSmartService(fake.client);

  await loadStudentAlerts({ userId: 'st-1', client: fake.client, limit: 12 });

  assert.equal(fake.calls.limit, 12);
});

test('la interfaz sobrevive cuando la migración de alertas aún no está aplicada', async () => {
  for (const code of ['42P01', 'PGRST205']) {
    const fake = fakeClient({ error: { code, message: 'relation "public.smart_alerts" does not exist' } });
    const { loadStudentAlerts } = loadSmartService(fake.client);
    assert.deepEqual(await loadStudentAlerts({ userId: 'st-1', client: fake.client }), []);
  }
});

test('otros errores se informan para mostrarlos en la interfaz', async () => {
  const fake = fakeClient({ error: { code: '42501', message: 'permission denied for table smart_alerts' } });
  const { loadStudentAlerts } = loadSmartService(fake.client);

  await assert.rejects(
    () => loadStudentAlerts({ userId: 'st-1', client: fake.client }),
    /permission denied for table smart_alerts/,
  );
});
