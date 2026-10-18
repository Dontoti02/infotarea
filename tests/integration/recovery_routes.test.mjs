import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS DE INTEGRACIÓN - ITERACIÓN Nº 4 (ítem 23 ampliado)
 * Rutas reales de la recuperación de contraseña:
 *   - POST /api/auth/recovery
 *   - GET  /auth/confirm
 *
 * Solo se reemplazan los límites externos (acceso elevado, SMTP, GoTrue y la
 * sesión de Supabase). Los manejadores, la validación y las respuestas son
 * reales.
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
    if (name === '@/shared/utils/passwordRecovery') return loadShared('passwordRecovery');
    return realRequire(name);
  };
  new Function('module', 'exports', 'require', output)(loadedModule, loadedModule.exports, require);
  return loadedModule.exports;
}

const recoveryRoute = overrides => loadModule('../../src/app/api/auth/recovery/route.ts', overrides);
const confirmRoute = overrides => loadModule('../../src/app/auth/confirm/route.ts', overrides);

const jsonRequest = (url, body, headers = {}) => new Request(url, {
  method: 'POST',
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...headers },
});

const configuredConfig = {
  settings: {
    enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_security: 'tls',
    smtp_user: 'colegio@gmail.com',
    from_email: 'colegio@gmail.com',
    from_name: 'Colegio InfoTarea',
    reply_to: null,
    alert_config: {},
  },
  password: 'abcd efgh ijkl mnop',
  migrationPending: false,
  backend: 'service-role',
};

function recoveryDeps({
  token = { ok: true, hashedToken: 'tok-secreto-123' },
  counts = { byEmail: 0, byRequester: 0 },
  countError = null,
  config = configuredConfig,
  configError = null,
  sendResult = { ok: true, messageId: 'smtp-1' },
} = {}) {
  const calls = { generate: [], counts: [], records: [], logs: [], sends: [] };
  const overrides = {
    '@/modules/smart/services/adminData': {
      generateRecoveryToken: async email => {
        calls.generate.push(email);
        return token;
      },
      countRecentPasswordResetRequests: async input => {
        calls.counts.push(input);
        if (countError) throw countError;
        return counts;
      },
      recordPasswordResetRequest: async input => {
        calls.records.push(input);
        return 'service-role';
      },
      readEmailConfig: async () => {
        if (configError) throw configError;
        return config;
      },
      appendEmailLogs: async rows => {
        calls.logs.push(...rows);
      },
    },
    '@/modules/smart/services/emailService': {
      sendPasswordResetEmail: async (transport, options) => {
        calls.sends.push({ transport, options });
        return sendResult;
      },
    },
  };
  return { calls, overrides };
}

function installFetchStub({ ok = true } = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response('{}', { status: ok ? 200 : 429 });
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/* ─────────────────────────────────────────────────────────────
 * POST /api/auth/recovery
 * ───────────────────────────────────────────────────────────── */

test('la solicitud rechaza correos inválidos antes de cualquier consulta', async () => {
  const deps = recoveryDeps();
  const handlers = recoveryRoute(deps.overrides);

  const missing = await handlers.POST(jsonRequest('http://localhost:3000/api/auth/recovery', {}));
  assert.equal(missing.status, 400);

  const invalid = await handlers.POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'sin-arroba' }));
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /correo electrónico válido/i);

  const broken = await handlers.POST(new Request('http://localhost:3000/api/auth/recovery', { method: 'POST', body: 'no-json' }));
  assert.equal(broken.status, 400);

  assert.equal(deps.calls.generate.length, 0);
  assert.equal(deps.calls.counts.length, 0);
});

test('un correo sin cuenta recibe la misma respuesta genérica sin enviar nada', async () => {
  const deps = recoveryDeps({ token: { ok: false, reason: 'not_found' } });
  const response = await recoveryRoute(deps.overrides)
    .POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'fantasma@escuela.edu' }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.match(body.message, /Si el correo pertenece a una cuenta/i);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');

  assert.equal(deps.calls.sends.length, 0);
  assert.equal(deps.calls.logs.length, 0);
  assert.equal(deps.calls.records.length, 1);
  assert.equal(deps.calls.records[0].deliveredVia, 'skipped');
});

test('con el correo propio activo envía el enlace interno por la cuenta Gmail', async () => {
  const deps = recoveryDeps();
  const response = await recoveryRoute(deps.overrides)
    .POST(jsonRequest(
      'http://interna:3000/api/auth/recovery',
      { email: '  Docente@Escuela.EDU ' },
      { 'x-forwarded-host': 'infotarea.example', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    ));

  assert.equal(response.status, 200);
  assert.deepEqual(deps.calls.generate, ['docente@escuela.edu']);

  assert.equal(deps.calls.sends.length, 1);
  const send = deps.calls.sends[0];
  assert.equal(send.options.to, 'docente@escuela.edu');
  assert.equal(send.options.expiresMinutes, 60);
  assert.equal(send.transport.settings.smtp_host, 'smtp.gmail.com');
  assert.equal(send.transport.password, 'abcd efgh ijkl mnop');

  const link = new URL(send.options.link);
  assert.equal(link.origin, 'https://infotarea.example');
  assert.equal(link.pathname, '/auth/confirm');
  assert.equal(link.searchParams.get('token_hash'), 'tok-secreto-123');
  assert.equal(link.searchParams.get('type'), 'recovery');
  assert.equal(link.searchParams.get('next'), '/update-password');

  assert.equal(deps.calls.logs.length, 1);
  assert.equal(deps.calls.logs[0].kind, 'password_reset');
  assert.equal(deps.calls.logs[0].status, 'sent');
  assert.equal(deps.calls.logs[0].toEmail, 'docente@escuela.edu');

  assert.equal(deps.calls.records.length, 1);
  assert.equal(deps.calls.records[0].deliveredVia, 'app_smtp');
  assert.match(deps.calls.records[0].requesterHash, /^[0-9a-f]{32}$/);
  assert.equal(deps.calls.records[0].email, 'docente@escuela.edu');
});

test('un fallo del correo propio registra el intento y responde 502', async () => {
  const deps = recoveryDeps({ sendResult: { ok: false, error: 'Credenciales SMTP rechazadas.' } });
  const response = await recoveryRoute(deps.overrides)
    .POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'docente@escuela.edu' }));

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /No pudimos enviar el correo de recuperación/i);

  assert.equal(deps.calls.logs.length, 1);
  assert.equal(deps.calls.logs[0].status, 'failed');
  assert.equal(deps.calls.logs[0].errorMessage, 'Credenciales SMTP rechazadas.');
  assert.equal(deps.calls.records[0].deliveredVia, 'app_smtp');
});

test('sin clave de servicio delega en el correo estándar de Supabase', async () => {
  const deps = recoveryDeps({ token: { ok: false, reason: 'unavailable' } });
  const stub = installFetchStub({ ok: true });
  try {
    const response = await recoveryRoute(deps.overrides)
      .POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'docente@escuela.edu' }));

    assert.equal(response.status, 200);
    assert.equal(stub.calls.length, 1);
    const recoverUrl = new URL(stub.calls[0].url);
    assert.equal(recoverUrl.pathname, '/auth/v1/recover');
    assert.equal(recoverUrl.searchParams.get('redirect_to'), 'http://localhost:3000/update-password');
    assert.ok(stub.calls[0].init.headers.apikey);
    assert.equal(JSON.parse(stub.calls[0].init.body).email, 'docente@escuela.edu');

    assert.equal(deps.calls.records[0].deliveredVia, 'supabase_auth');
    assert.equal(deps.calls.sends.length, 0);
  } finally {
    stub.restore();
  }
});

test('con el correo propio apagado también usa el respaldo de Supabase', async () => {
  const deps = recoveryDeps({
    config: { ...configuredConfig, settings: { ...configuredConfig.settings, enabled: false } },
  });
  const stub = installFetchStub({ ok: false });
  try {
    const response = await recoveryRoute(deps.overrides)
      .POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'docente@escuela.edu' }));

    // Aunque el respaldo falle, la respuesta sigue siendo genérica.
    assert.equal(response.status, 200);
    assert.equal(stub.calls.length, 1);
    assert.equal(deps.calls.records[0].deliveredVia, 'skipped');
    assert.equal(deps.calls.sends.length, 0);
  } finally {
    stub.restore();
  }
});

test('un error real de GoTrue responde 502 sin revelar la cuenta', async () => {
  const deps = recoveryDeps({ token: { ok: false, reason: 'error', message: 'auth API caída' } });
  const response = await recoveryRoute(deps.overrides)
    .POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'docente@escuela.edu' }));

  assert.equal(response.status, 502);
  const body = await response.json();
  assert.doesNotMatch(body.error, /docente@escuela\.edu/);
  assert.equal(deps.calls.records[0].deliveredVia, 'skipped');
});

test('el límite de solicitudes responde genérico sin generar otro enlace', async () => {
  const deps = recoveryDeps({ counts: { byEmail: 3, byRequester: 3 } });
  const response = await recoveryRoute(deps.overrides)
    .POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'docente@escuela.edu' }));

  assert.equal(response.status, 200);
  assert.match((await response.json()).message, /Si el correo pertenece a una cuenta/i);
  assert.equal(deps.calls.generate.length, 0);
  assert.equal(deps.calls.records.length, 0);
});

test('si el control de abuso no está disponible la recuperación continúa', async () => {
  const deps = recoveryDeps({ countError: new Error('sin backend elevado') });
  const response = await recoveryRoute(deps.overrides)
    .POST(jsonRequest('http://localhost:3000/api/auth/recovery', { email: 'docente@escuela.edu' }));

  assert.equal(response.status, 200);
  assert.equal(deps.calls.generate.length, 1);
  assert.equal(deps.calls.sends.length, 1);
});

/* ─────────────────────────────────────────────────────────────
 * /auth/confirm (GET muestra la página; POST verifica el token)
 * ───────────────────────────────────────────────────────────── */

function confirmDeps({ verifyError = null } = {}) {
  const verifyCalls = [];
  const client = {
    auth: {
      verifyOtp: async input => {
        verifyCalls.push(input);
        return { data: { user: verifyError ? null : { id: 'u-1' } }, error: verifyError };
      },
    },
  };
  return { verifyCalls, overrides: { '@/lib/supabase/server': { createClient: async () => client } } };
}

const formRequest = (url, fields) => new Request(url, {
  method: 'POST',
  body: new URLSearchParams(fields),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});

test('la página de confirmación no consume el token (protege contra escáneres de correo)', async () => {
  const deps = confirmDeps();
  const response = await confirmRoute(deps.overrides)
    .GET(new Request('http://localhost:3000/auth/confirm?token_hash=tok-1&type=recovery'));

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const html = await response.text();
  assert.match(html, /method="post"/);
  assert.match(html, /name="token_hash" value="tok-1"/);
  assert.match(html, /name="type" value="recovery"/);
  assert.match(html, /name="next" value="\/update-password"/);

  // Clave: abrir el enlace (GET) no verifica ni gasta el token.
  assert.equal(deps.verifyCalls.length, 0);
});

test('el formulario de confirmación verifica el token y lleva a la nueva contraseña', async () => {
  const deps = confirmDeps();
  const response = await confirmRoute(deps.overrides)
    .POST(formRequest('http://localhost:3000/auth/confirm', {
      token_hash: 'tok-1',
      type: 'recovery',
      next: '/update-password',
    }));

  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'http://localhost:3000/update-password');
  assert.deepEqual(deps.verifyCalls, [{ type: 'recovery', token_hash: 'tok-1' }]);
});

test('la página de confirmación escapa los parámetros (sin XSS)', async () => {
  const deps = confirmDeps();
  const hostileToken = '"><script>alert(1)</script>';
  const response = await confirmRoute(deps.overrides)
    .GET(new Request(
      `http://localhost:3000/auth/confirm?token_hash=${encodeURIComponent(hostileToken)}&type=recovery&next=${encodeURIComponent('https://evil.example')}`,
    ));

  const html = await response.text();
  assert.ok(!html.includes('"><script>alert(1)</script>'));
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
  // El destino externo se reemplaza por la ruta interna segura.
  assert.match(html, /name="next" value="\/update-password"/);
});

test('un destino externo se ignora y un destino interno se respeta', async () => {
  const hostile = confirmDeps();
  const hostileResponse = await confirmRoute(hostile.overrides)
    .POST(formRequest('http://localhost:3000/auth/confirm', {
      token_hash: 'tok-1',
      type: 'recovery',
      next: 'https://evil.example',
    }));
  assert.equal(hostileResponse.headers.get('location'), 'http://localhost:3000/update-password');

  const custom = confirmDeps();
  const customResponse = await confirmRoute(custom.overrides)
    .POST(formRequest('http://localhost:3000/auth/confirm', {
      token_hash: 'tok-1',
      type: 'recovery',
      next: '/bienvenida',
    }));
  assert.equal(customResponse.headers.get('location'), 'http://localhost:3000/bienvenida');
});

test('un enlace vencido o alterado vuelve al formulario con aviso', async () => {
  const expired = confirmDeps({ verifyError: { message: 'Token has expired or is invalid', status: 401 } });
  const expiredResponse = await confirmRoute(expired.overrides)
    .POST(formRequest('http://localhost:3000/auth/confirm', { token_hash: 'tok-viejo', type: 'recovery' }));
  assert.equal(expiredResponse.status, 303);
  assert.equal(expiredResponse.headers.get('location'), 'http://localhost:3000/forgot-password?error=enlace');

  const incompleteGet = confirmDeps();
  const incompleteGetResponse = await confirmRoute(incompleteGet.overrides)
    .GET(new Request('http://localhost:3000/auth/confirm?type=recovery'));
  assert.equal(incompleteGetResponse.status, 303);
  assert.equal(incompleteGetResponse.headers.get('location'), 'http://localhost:3000/forgot-password?error=enlace');

  const incompletePost = confirmDeps();
  const incompletePostResponse = await confirmRoute(incompletePost.overrides)
    .POST(formRequest('http://localhost:3000/auth/confirm', { type: 'recovery' }));
  assert.equal(incompletePostResponse.headers.get('location'), 'http://localhost:3000/forgot-password?error=enlace');
  assert.equal(incompletePost.verifyCalls.length, 0);
});
