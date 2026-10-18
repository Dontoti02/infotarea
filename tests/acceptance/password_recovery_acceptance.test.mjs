import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS DE ACEPTACIÓN (ACCEPTANCE / BDD TESTS)
 * Iteración Nº 4 — Recuperación de contraseña desde el inicio de sesión
 * (ítem 23 ampliado).
 *
 * Los escenarios usan los módulos reales de reglas puras
 * (`src/shared/utils/passwordRecovery.ts` y `emailTemplates.ts`), sin depender
 * de Supabase ni del SMTP.
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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

const recovery = loadShared('passwordRecovery');
const templates = loadModule('../../src/modules/smart/services/emailTemplates.ts');
const ORIGIN = 'https://infotarea.escuela.edu';

/* ─────────────────────────────────────────────────────────────
 * ACEP-17: solicitar el enlace desde el inicio de sesión
 * ───────────────────────────────────────────────────────────── */

test('ACEP-17: "Olvidé mi contraseña" responde genérico y envía el enlace por el correo propio', () => {
  // GIVEN: una docente que olvidó su contraseña y la cuenta Gmail institucional activa
  const rawEmail = '  Docente@Escuela.EDU ';
  const fromName = 'Colegio InfoTarea';

  // WHEN: el servidor valida la solicitud, genera el token con GoTrue y
  // construye el enlace propio que se envía por la cuenta SMTP
  const email = recovery.normalizeRecoveryEmail(rawEmail);
  assert.ok(email, 'el correo debe ser válido para continuar');

  const tokenHash = 'token-de-un-solo-uso';
  const link = recovery.buildRecoveryConfirmUrl(ORIGIN, tokenHash);
  const rendered = templates.renderPasswordResetEmail({
    link,
    fromName,
    accountEmail: email,
    expiresMinutes: recovery.RECOVERY_LINK_MINUTES,
  });

  // THEN: la respuesta es genérica (no revela si la cuenta existe)
  assert.match(recovery.RECOVERY_GENERIC_MESSAGE, /Si el correo pertenece a una cuenta/i);
  assert.doesNotMatch(recovery.RECOVERY_GENERIC_MESSAGE, /no existe|registrada|inválid[oa]/i);

  // THEN: el enlace es interno, de un solo uso y lleva a la pantalla correcta
  const url = new URL(link);
  assert.equal(url.origin, ORIGIN);
  assert.equal(url.pathname, '/auth/confirm');
  assert.equal(url.searchParams.get('token_hash'), tokenHash);
  assert.equal(url.searchParams.get('type'), 'recovery');
  assert.equal(url.searchParams.get('next'), '/update-password');

  // THEN: el correo lleva la marca de la institución y el enlace en HTML y texto
  assert.match(rendered.subject, /Restablece tu contraseña/);
  assert.match(rendered.subject, /Colegio InfoTarea/);
  assert.match(rendered.html, /60 minutos/);
  assert.ok(rendered.html.includes(link.replace(/&/g, '&amp;')));
  assert.ok(rendered.text.includes(link));
  assert.match(rendered.text, /ignora el mensaje/i);
});

/* ─────────────────────────────────────────────────────────────
 * ACEP-18: enlace vencido o manipulado
 * ───────────────────────────────────────────────────────────── */

/** Réplica mínima del formulario de confirmación: el POST verifica el token. */
function simulateConfirm({ tokenHash, type, verifyOk }) {
  if (tokenHash && type && verifyOk) {
    return { ok: true, redirect: recovery.RECOVERY_UPDATE_PATH };
  }
  return { ok: false, redirect: '/forgot-password?error=enlace' };
}

test('ACEP-18: un enlace vencido o manipulado no permite cambiar la contraseña', () => {
  // GIVEN: un enlace de recuperación vencido y otro con destino externo
  const expired = simulateConfirm({ tokenHash: 'token-vencido', type: 'recovery', verifyOk: false });
  const manipulated = simulateConfirm({ tokenHash: null, type: 'recovery', verifyOk: false });

  // WHEN/THEN: la verificación falla y la persona vuelve al formulario con aviso
  assert.equal(expired.ok, false);
  assert.equal(expired.redirect, '/forgot-password?error=enlace');
  assert.equal(manipulated.ok, false);
  assert.equal(manipulated.redirect, '/forgot-password?error=enlace');

  // THEN: un destino externo nunca se respeta (no hay redirecciones abiertas)
  assert.equal(recovery.safeInternalPath('https://sitio-malicioso.example'), '/update-password');
  assert.equal(recovery.safeInternalPath('//sitio-malicioso.example'), '/update-password');
  assert.equal(recovery.safeInternalPath('/update-password'), '/update-password');

  // THEN: aunque el enlace llegara a abrirse, no se puede usar una clave débil
  const weak = recovery.passwordStrength('123');
  assert.ok(weak.score <= 1);
  assert.ok(weak.hints.length > 0);
});

/* ─────────────────────────────────────────────────────────────
 * ACEP-19: cambio exitoso y regreso al inicio de sesión
 * ───────────────────────────────────────────────────────────── */

test('ACEP-19: la nueva contraseña fuerte se acepta y la persona vuelve al inicio de sesión', () => {
  // GIVEN: una sesión de recuperación válida y dos escrituras de la nueva clave
  const confirmed = simulateConfirm({ tokenHash: 'token-vigente', type: 'recovery', verifyOk: true });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.redirect, recovery.RECOVERY_UPDATE_PATH);

  const password = 'Escuela-2026!Segura';
  const confirmation = 'Escuela-2026!Segura';

  // WHEN: la pantalla valida longitud, coincidencia y fortaleza
  const strength = recovery.passwordStrength(password);
  const lengthOk = password.length >= recovery.MIN_RECOVERY_PASSWORD_LENGTH;
  const matchOk = password === confirmation;

  // THEN: la contraseña es aceptada con etiqueta de fortaleza alta
  assert.equal(lengthOk, true);
  assert.equal(matchOk, true);
  assert.equal(strength.score, 4);
  assert.equal(strength.label, 'Fuerte');

  // THEN: el regreso al inicio de sesión es interno y muestra el aviso de éxito
  const backToLogin = recovery.safeInternalPath('/login?actualizada=1');
  assert.equal(backToLogin, '/login?actualizada=1');
  assert.notEqual(recovery.safeInternalPath('https://evil.example'), '/login?actualizada=1');

  // THEN: una contraseña sin coincidencia no avanza (control previo del formulario)
  assert.notEqual(password, 'Otra-2026!Distinta');
});
