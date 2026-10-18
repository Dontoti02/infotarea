import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS TDD - ITERACIÓN Nº 4 (ítem 23 ampliado)
 * Recuperación de contraseña desde el inicio de sesión.
 *
 * Se carga el módulo real `src/shared/utils/passwordRecovery.ts` y se
 * verifican las reglas puras: correo válido, enlaces seguros, fortaleza de la
 * contraseña y control de abuso.
 */

const realRequire = createRequire(import.meta.url);
const cache = new Map();

function loadModule(relative) {
  const path = new URL(relative, import.meta.url);
  const key = path.href;
  if (cache.has(key)) return cache.get(key);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path.pathname,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  cache.set(key, loadedModule.exports);
  const require = name => {
    if (name === './prioritization') return loadModule('../../src/shared/utils/prioritization.ts');
    return realRequire(name);
  };
  new Function('module', 'exports', 'require', output)(loadedModule, loadedModule.exports, require);
  cache.set(key, loadedModule.exports);
  return loadedModule.exports;
}

const logic = loadModule('../../src/shared/utils/passwordRecovery.ts');

/* ─────────────────────────────────────────────────────────────
 * Correo de recuperación
 * ───────────────────────────────────────────────────────────── */

test('TDD-R01: normaliza el correo y rechaza entradas inválidas', () => {
  assert.equal(logic.normalizeRecoveryEmail('  Ana.Perez@Escuela.EDU '), 'ana.perez@escuela.edu');
  assert.equal(logic.normalizeRecoveryEmail('direccion@institucion.edu'), 'direccion@institucion.edu');
  assert.equal(logic.normalizeRecoveryEmail('sin-arroba'), null);
  assert.equal(logic.normalizeRecoveryEmail('dos@@escuela.edu'), null);
  assert.equal(logic.normalizeRecoveryEmail(''), null);
  assert.equal(logic.normalizeRecoveryEmail(null), null);
  assert.equal(logic.normalizeRecoveryEmail(42), null);
});

test('TDD-R02: solo acepta rutas internas para evitar redirecciones abiertas', () => {
  assert.equal(logic.safeInternalPath('/update-password'), '/update-password');
  assert.equal(logic.safeInternalPath('/restablecer?paso=2'), '/restablecer?paso=2');
  assert.equal(logic.safeInternalPath('https://sitio-malicioso.example'), logic.RECOVERY_UPDATE_PATH);
  assert.equal(logic.safeInternalPath('//sitio-malicioso.example'), logic.RECOVERY_UPDATE_PATH);
  assert.equal(logic.safeInternalPath('javascript:alert(1)'), logic.RECOVERY_UPDATE_PATH);
  assert.equal(logic.safeInternalPath(undefined), logic.RECOVERY_UPDATE_PATH);
  assert.equal(logic.safeInternalPath('/ruta\nInyectada'), logic.RECOVERY_UPDATE_PATH);
});

test('TDD-R03: construye el enlace propio de confirmación con token y destino', () => {
  const url = new URL(logic.buildRecoveryConfirmUrl('https://infotarea.app', 'hash-123'));
  assert.equal(url.origin, 'https://infotarea.app');
  assert.equal(url.pathname, '/auth/confirm');
  assert.equal(url.searchParams.get('token_hash'), 'hash-123');
  assert.equal(url.searchParams.get('type'), 'recovery');
  assert.equal(url.searchParams.get('next'), '/update-password');

  const custom = new URL(logic.buildRecoveryConfirmUrl('https://infotarea.app/', 'otro-hash', '/bienvenida'));
  assert.equal(custom.searchParams.get('next'), '/bienvenida');

  // Un `next` externo se descarta silenciosamente.
  const hostile = new URL(logic.buildRecoveryConfirmUrl('https://infotarea.app', 'h', 'https://evil.example'));
  assert.equal(hostile.searchParams.get('next'), '/update-password');
});

/* ─────────────────────────────────────────────────────────────
 * Fortaleza de la nueva contraseña
 * ───────────────────────────────────────────────────────────── */

test('TDD-R04: evalúa la fortaleza de la nueva contraseña con pistas claras', () => {
  const weak = logic.passwordStrength('abc');
  assert.ok(weak.score <= 1);
  assert.ok(weak.hints.some(hint => hint.includes(String(logic.MIN_RECOVERY_PASSWORD_LENGTH))));

  const repeated = logic.passwordStrength('aaaaaaaaaaaa');
  assert.equal(repeated.score, 0);
  assert.match(repeated.hints[0], /repetir/i);

  const acceptable = logic.passwordStrength('Escuela2026');
  assert.ok(acceptable.score >= 2);

  const strong = logic.passwordStrength('Escuela-2026!Segura');
  assert.equal(strong.score, 4);
  assert.equal(strong.label, 'Fuerte');
  assert.equal(strong.hints.length, 0);
});

/* ─────────────────────────────────────────────────────────────
 * Control de abuso
 * ───────────────────────────────────────────────────────────── */

test('TDD-R05: limita solicitudes por correo y por solicitante', () => {
  assert.equal(logic.recoveryRateLimitExceeded({ byEmail: 0, byRequester: 0 }), false);
  assert.equal(
    logic.recoveryRateLimitExceeded({ byEmail: logic.MAX_RECOVERY_REQUESTS_PER_EMAIL - 1, byRequester: 1 }),
    false,
  );
  assert.equal(
    logic.recoveryRateLimitExceeded({ byEmail: logic.MAX_RECOVERY_REQUESTS_PER_EMAIL, byRequester: 1 }),
    true,
  );
  assert.equal(
    logic.recoveryRateLimitExceeded({ byEmail: 0, byRequester: logic.MAX_RECOVERY_REQUESTS_PER_REQUESTER }),
    true,
  );
});

test('TDD-R06: el mensaje genérico no revela si el correo existe', () => {
  assert.match(logic.RECOVERY_GENERIC_MESSAGE, /Si el correo pertenece a una cuenta/i);
  assert.doesNotMatch(logic.RECOVERY_GENERIC_MESSAGE, /no existe|no está registrado|inválido/i);
});
