import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS DE INTEGRACIÓN - ITERACIÓN Nº 4 (ítem 23)
 * Rutas reales del correo saliente:
 *   - GET/PUT /api/admin/email-settings
 *   - POST     /api/admin/email-test
 *   - POST/GET /api/alerts/sweep
 *
 * Se reemplazan únicamente los límites externos (Supabase, SMTP y el acceso
 * elevado a datos). Los manejadores, la validación y las respuestas son reales.
 */

const realRequire = createRequire(import.meta.url);
const ADMIN = 'aaaaaaaa-1111-4111-8111-111111111111';

function loadModule(relative, overrides = {}) {
  const path = new URL(relative, import.meta.url);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path.pathname,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  const require = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === '@/shared/utils/prioritization') return loadModule('../../src/shared/utils/prioritization.ts');
    return realRequire(name);
  };
  new Function('module', 'exports', 'require', output)(loadedModule, loadedModule.exports, require);
  return loadedModule.exports;
}

/** Cliente Supabase en memoria: solo implementa lo que usan las rutas. */
function clientFor({
  user = { id: ADMIN },
  profile = { role: 'admin', email: 'direccion@escuela.edu' },
  settingsRow = null,
  settingsError = null,
} = {}) {
  const store = settingsRow ? [structuredClone(settingsRow)] : [];
  const client = {
    authCalls: 0,
    store,
    auth: {
      getUser: async () => {
        client.authCalls += 1;
        return { data: { user }, error: null };
      },
    },
    from(table) {
      const filters = [];
      let action = 'select';
      let values = {};
      const query = {
        select() { return query; },
        eq(field, value) { filters.push(row => row[field] === value); return query; },
        update(data) { action = 'update'; values = data; return query; },
        async maybeSingle() {
          if (table === 'email_settings' && settingsError) return { data: null, error: settingsError };
          const index = store.findIndex(row => filters.every(filter => filter(row)));
          if (index < 0) return { data: null, error: null };
          if (action === 'update') Object.assign(store[index], values);
          return { data: structuredClone(store[index]), error: null };
        },
        async single() {
          if (table === 'profiles') return { data: profile, error: null };
          const index = store.findIndex(row => filters.every(filter => filter(row)));
          if (index < 0) return { data: null, error: { code: 'PGRST116' } };
          return { data: structuredClone(store[index]), error: null };
        },
      };
      return query;
    },
  };
  return client;
}

const settingsRoute = overrides => loadModule('../../src/app/api/admin/email-settings/route.ts', overrides);
const testRoute = overrides => loadModule('../../src/app/api/admin/email-test/route.ts', overrides);
const sweepRoute = overrides => loadModule('../../src/app/api/alerts/sweep/route.ts', overrides);

const jsonRequest = (url, method, body) => new Request(url, {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
});

const baseRow = {
  id: true,
  enabled: false,
  smtp_host: 'smtp.gmail.com',
  smtp_port: 587,
  smtp_security: 'tls',
  smtp_user: null,
  from_email: null,
  from_name: null,
  reply_to: null,
  alert_config: {},
};

const validSettings = {
  enabled: true,
  smtp_host: 'SMTP.GMAIL.COM',
  smtp_port: 587,
  smtp_security: 'tls',
  smtp_user: 'colegio@gmail.com',
  from_email: 'colegio@gmail.com',
  from_name: 'Colegio InfoTarea',
};

function adminDataFake({ presence = { available: true, hasPassword: false }, throwOnWrite = false } = {}) {
  const writes = [];
  return {
    writes,
    module: {
      readEmailPasswordPresence: async () => presence,
      writeEmailPassword: async password => {
        if (throwOnWrite) throw new Error('sin conexión elevada');
        writes.push(password);
        return 'service-role';
      },
    },
  };
}

/* ─────────────────────────────────────────────────────────────
 * /api/admin/email-settings
 * ───────────────────────────────────────────────────────────── */

test('la configuración de correo exige sesión y rol de dirección', async () => {
  const anonymous = clientFor({ user: null });
  const handlers = settingsRoute({ '@/lib/supabase/server': { createClient: async () => anonymous }, '@/modules/smart/services/adminData': adminDataFake().module });
  assert.equal((await handlers.GET()).status, 401);
  assert.equal((await handlers.PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', validSettings))).status, 401);
  assert.equal(anonymous.authCalls, 2);
  assert.deepEqual(anonymous.store, []);

  const student = clientFor({ profile: { role: 'student', email: 'ana@escuela.edu' } });
  const forbidden = settingsRoute({ '@/lib/supabase/server': { createClient: async () => student }, '@/modules/smart/services/adminData': adminDataFake().module });
  assert.equal((await forbidden.GET()).status, 403);
  assert.equal((await forbidden.PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', validSettings))).status, 403);
});

test('GET devuelve valores seguros y avisa cuando falta la migración', async () => {
  const client = clientFor();
  const fake = adminDataFake();
  const response = await settingsRoute({ '@/lib/supabase/server': { createClient: async () => client }, '@/modules/smart/services/adminData': fake.module }).GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.migrationPending, true);
  assert.equal(body.hasPassword, false);
  assert.equal(body.settings.smtp_host, 'smtp.gmail.com');
  assert.equal(body.settings.smtp_port, 587);
  assert.equal(body.settings.smtp_security, 'tls');
  assert.equal(body.settings.enabled, false);
});

test('PUT rechaza configuraciones inválidas sin tocar la base de datos', async () => {
  const client = clientFor({ settingsRow: baseRow });
  const fake = adminDataFake();
  const handlers = settingsRoute({ '@/lib/supabase/server': { createClient: async () => client }, '@/modules/smart/services/adminData': fake.module });

  const insecure = await handlers.PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', { ...validSettings, smtp_security: 'ssl' }));
  assert.equal(insecure.status, 400);
  const body = await insecure.json();
  assert.ok(body.errors.some(error => /Gmail.*465/.test(error)));

  const withoutHost = await handlers.PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', { ...validSettings, smtp_host: '' }));
  assert.equal(withoutHost.status, 400);

  assert.equal(client.store[0].enabled, false);
  assert.equal(client.store[0].from_email, null);
  assert.equal(fake.writes.length, 0);
});

test('PUT guarda la configuración y conserva la contraseña existente', async () => {
  const client = clientFor({ settingsRow: baseRow });
  const fake = adminDataFake({ presence: { available: true, hasPassword: true } });
  const response = await settingsRoute({ '@/lib/supabase/server': { createClient: async () => client }, '@/modules/smart/services/adminData': fake.module })
    .PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', validSettings));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.settings.enabled, true);
  assert.equal(body.settings.smtp_host, 'smtp.gmail.com');
  assert.equal(body.hasPassword, true);
  assert.equal(fake.writes.length, 0);

  assert.equal(client.store[0].smtp_host, 'smtp.gmail.com');
  assert.equal(client.store[0].smtp_user, 'colegio@gmail.com');
  assert.equal(client.store[0].from_name, 'Colegio InfoTarea');
  assert.equal(client.store[0].updated_by, ADMIN);
});

test('PUT guarda la contraseña de aplicación sin espacios y permite borrarla', async () => {
  const client = clientFor({ settingsRow: baseRow });
  const fake = adminDataFake();
  const handlers = settingsRoute({ '@/lib/supabase/server': { createClient: async () => client }, '@/modules/smart/services/adminData': fake.module });

  const saved = await handlers.PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', { ...validSettings, smtp_password: 'abcd efgh ijkl mnop' }));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).hasPassword, true);
  assert.deepEqual(fake.writes, ['abcdefghijklmnop']);

  const cleared = await handlers.PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', { ...validSettings, clear_password: true }));
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).hasPassword, false);
  assert.deepEqual(fake.writes, ['abcdefghijklmnop', null]);
});

test('PUT responde 503 con la migración pendiente cuando la tabla no existe', async () => {
  const client = clientFor({ settingsRow: baseRow, settingsError: { code: '42P01', message: 'relation "public.email_settings" does not exist' } });
  const response = await settingsRoute({ '@/lib/supabase/server': { createClient: async () => client }, '@/modules/smart/services/adminData': adminDataFake().module })
    .PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', validSettings));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /20261018000000_iteracion_4_priorizacion_correo\.sql/);
});

test('PUT informa 502 si la contraseña falla, conservando la configuración guardada', async () => {
  const client = clientFor({ settingsRow: baseRow });
  const fake = adminDataFake({ throwOnWrite: true });
  const response = await settingsRoute({ '@/lib/supabase/server': { createClient: async () => client }, '@/modules/smart/services/adminData': fake.module })
    .PUT(jsonRequest('http://localhost/api/admin/email-settings', 'PUT', { ...validSettings, smtp_password: 'contraseña-de-aplicación' }));

  assert.equal(response.status, 502);
  const body = await response.json();
  assert.match(body.error, /contraseña de aplicación no/i);
  assert.equal(body.settings.smtp_host, 'smtp.gmail.com');
  assert.equal(body.hasPassword, false);
  assert.equal(client.store[0].enabled, true);
});

/* ─────────────────────────────────────────────────────────────
 * /api/admin/email-test
 * ───────────────────────────────────────────────────────────── */

const configuredEmailConfig = {
  settings: {
    enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_security: 'tls',
    smtp_user: 'colegio@gmail.com',
    from_email: 'colegio@gmail.com',
    from_name: 'Colegio InfoTarea',
    reply_to: null,
    alert_config: {
      task_due_soon: true,
      task_overdue: true,
      submission_pending_review: true,
      student_at_risk: true,
      weekly_summary: true,
    },
  },
  password: 'abcd efgh ijkl mnop',
  migrationPending: false,
  backend: 'service-role',
};

function emailTestDeps({ config = configuredEmailConfig, sendResult = { ok: true, messageId: 'smtp-1' }, configError = null } = {}) {
  const sent = [];
  const logs = [];
  return {
    sent,
    logs,
    overrides: {
      '@/modules/smart/services/adminData': {
        readEmailConfig: async () => {
          if (configError) throw configError;
          return config;
        },
        appendEmailLogs: async rows => { logs.push(...rows); },
      },
      '@/modules/smart/services/emailService': {
        sendTestEmail: async (transport, to) => {
          sent.push({ transport, to });
          return sendResult;
        },
      },
    },
  };
}

test('el correo de prueba exige dirección y un destino válido', async () => {
  const deps = emailTestDeps();
  const client = clientFor({ user: null });
  const anonymous = testRoute({ '@/lib/supabase/server': { createClient: async () => client }, ...deps.overrides });
  assert.equal((await anonymous.POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', {}))).status, 401);

  const student = clientFor({ profile: { role: 'student', email: 'ana@escuela.edu' } });
  const forbidden = testRoute({ '@/lib/supabase/server': { createClient: async () => student }, ...deps.overrides });
  assert.equal((await forbidden.POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', {}))).status, 403);

  const admin = clientFor();
  const invalid = testRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...deps.overrides });
  assert.equal((await invalid.POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', { to: 'no-es-correo' }))).status, 400);
  assert.equal(deps.sent.length, 0);
});

test('el correo de prueba usa el correo de la dirección cuando no se indica destino', async () => {
  const deps = emailTestDeps();
  const client = clientFor();
  const response = await testRoute({ '@/lib/supabase/server': { createClient: async () => client }, ...deps.overrides })
    .POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', {}));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.match(body.message, /direccion@escuela\.edu/);
  assert.equal(deps.sent[0].to, 'direccion@escuela.edu');
  assert.equal(deps.logs[0].status, 'sent');
  assert.equal(deps.logs[0].kind, 'test');
});

test('el correo de prueba distingue migración pendiente, correo apagado y fallos SMTP', async () => {
  const admin = clientFor();
  const pending = emailTestDeps({ config: { ...configuredEmailConfig, migrationPending: true, settings: { ...configuredEmailConfig.settings, enabled: false } } });
  const pendingResponse = await testRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...pending.overrides })
    .POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', {}));
  assert.equal(pendingResponse.status, 503);
  assert.match((await pendingResponse.json()).error, /migración/);

  const disabled = emailTestDeps({ config: { ...configuredEmailConfig, settings: { ...configuredEmailConfig.settings, enabled: false } } });
  const disabledResponse = await testRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...disabled.overrides })
    .POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', {}));
  assert.equal(disabledResponse.status, 400);
  assert.equal(disabled.sent.length, 0);

  const failing = emailTestDeps({ sendResult: { ok: false, error: 'Credenciales SMTP rechazadas.' } });
  const failingResponse = await testRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...failing.overrides })
    .POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', { to: 'direccion@escuela.edu' }));
  assert.equal(failingResponse.status, 502);
  assert.equal(failing.logs[0].status, 'failed');
  assert.equal(failing.logs[0].errorMessage, 'Credenciales SMTP rechazadas.');

  const broken = emailTestDeps({ configError: new Error('No se pudo leer la configuración de correo.') });
  const brokenResponse = await testRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...broken.overrides })
    .POST(jsonRequest('http://localhost/api/admin/email-test', 'POST', {}));
  assert.equal(brokenResponse.status, 503);
});

/* ─────────────────────────────────────────────────────────────
 * /api/alerts/sweep
 * ───────────────────────────────────────────────────────────── */

const sweepResult = {
  generated: 3,
  duplicates: 1,
  emailsSent: 2,
  emailsFailed: 0,
  emailEnabled: true,
  backend: 'service-role',
  details: [],
  errors: [],
};

function sweepDeps({ result = sweepResult, failure = null } = {}) {
  class FakeAdminDataError extends Error {
    constructor(message, code = 'admin_data_unavailable') {
      super(message);
      this.name = 'AdminDataError';
      this.code = code;
    }
  }
  return {
    class: FakeAdminDataError,
    overrides: {
      '@/modules/smart/services/adminData': { AdminDataError: FakeAdminDataError },
      '@/modules/smart/services/alertEngine': {
        runAlertSweep: async () => {
          if (failure) throw failure;
          return result;
        },
      },
    },
  };
}

test('la ejecución de alertas exige dirección o token de automatización', async () => {
  const previousAlerts = process.env.ALERTS_CRON_SECRET;
  const previousCron = process.env.CRON_SECRET;
  delete process.env.ALERTS_CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const anonymous = clientFor({ user: null });
    const deps = sweepDeps();
    const handlers = sweepRoute({ '@/lib/supabase/server': { createClient: async () => anonymous }, ...deps.overrides });
    assert.equal((await handlers.POST(jsonRequest('http://localhost/api/alerts/sweep', 'POST', undefined))).status, 401);
    assert.equal((await handlers.POST(jsonRequest('http://localhost/api/alerts/sweep', 'POST', undefined))).headers.get('content-type')?.includes('application/json'), true);

    const student = clientFor({ profile: { role: 'student', email: null } });
    const forbidden = sweepRoute({ '@/lib/supabase/server': { createClient: async () => student }, ...deps.overrides });
    assert.equal((await forbidden.POST(jsonRequest('http://localhost/api/alerts/sweep', 'POST', undefined))).status, 403);
  } finally {
    if (previousAlerts === undefined) delete process.env.ALERTS_CRON_SECRET; else process.env.ALERTS_CRON_SECRET = previousAlerts;
    if (previousCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previousCron;
  }
});

test('un token Bearer autoriza el cron sin sesión y GET funciona igual que POST', async () => {
  const previousAlerts = process.env.ALERTS_CRON_SECRET;
  const previousCron = process.env.CRON_SECRET;
  process.env.ALERTS_CRON_SECRET = 'token-de-cron';
  delete process.env.CRON_SECRET;
  try {
    const client = clientFor({ user: null });
    const deps = sweepDeps();
    const handlers = sweepRoute({ '@/lib/supabase/server': { createClient: async () => client }, ...deps.overrides });

    const authorized = {
      method: 'POST',
      headers: { Authorization: 'Bearer token-de-cron' },
    };
    const response = await handlers.POST(new Request('http://localhost/api/alerts/sweep', authorized));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.via, 'cron');
    assert.equal(body.result.generated, 3);
    assert.equal(client.authCalls, 0);

    const wrong = await handlers.POST(new Request('http://localhost/api/alerts/sweep', { method: 'POST', headers: { Authorization: 'Bearer otro-token' } }));
    assert.equal(wrong.status, 401);

    const viaGet = await handlers.GET(new Request('http://localhost/api/alerts/sweep', authorized));
    assert.equal(viaGet.status, 200);
    assert.equal((await viaGet.json()).via, 'cron');
  } finally {
    if (previousAlerts === undefined) delete process.env.ALERTS_CRON_SECRET; else process.env.ALERTS_CRON_SECRET = previousAlerts;
    if (previousCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previousCron;
  }
});

test('la dirección ejecuta el motor y recibe el resumen; los errores se clasifican', async () => {
  const admin = clientFor();
  const ok = sweepDeps();
  const handlers = sweepRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...ok.overrides });
  const response = await handlers.POST(jsonRequest('http://localhost/api/alerts/sweep', 'POST', undefined));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.via, 'admin');
  assert.equal(body.result.emailsSent, 2);

  const pending = sweepDeps({ failure: new Error('relation "public.smart_alerts" does not exist') });
  const pendingHandlers = sweepRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...pending.overrides });
  const pendingResponse = await pendingHandlers.POST(jsonRequest('http://localhost/api/alerts/sweep', 'POST', undefined));
  assert.equal(pendingResponse.status, 503);
  assert.match((await pendingResponse.json()).error, /20261018000000_iteracion_4_priorizacion_correo\.sql/);

  const unavailable = sweepDeps({ failure: new Error('sin backend') });
  const unavailableHandlers = sweepRoute({ '@/lib/supabase/server': { createClient: async () => admin }, ...unavailable.overrides });
  assert.equal((await unavailableHandlers.POST(jsonRequest('http://localhost/api/alerts/sweep', 'POST', undefined))).status, 500);

  const typed = sweepDeps();
  const typedFailure = new typed.class('No hay backend elevado disponible.');
  const typedHandlers = sweepRoute({
    '@/lib/supabase/server': { createClient: async () => admin },
    '@/modules/smart/services/alertEngine': { runAlertSweep: async () => { throw typedFailure; } },
    '@/modules/smart/services/adminData': { AdminDataError: typed.class },
  });
  const typedResponse = await typedHandlers.POST(jsonRequest('http://localhost/api/alerts/sweep', 'POST', undefined));
  assert.equal(typedResponse.status, 503);
  assert.match((await typedResponse.json()).error, /backend elevado/);
});
