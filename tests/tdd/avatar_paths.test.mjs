import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS TDD — «MI CUENTA» (foto de perfil por rol)
 *
 * Se carga el módulo real `src/shared/utils/storage.ts` y se verifican las
 * reglas puras que usan el modal «Mi Cuenta» y la página de configuración de
 * cada rol para subir la foto de perfil al bucket `img_perfiles`:
 *   - construir la ruta interna de la nueva foto (`<userId>/avatar-<marca>.<ext>`)
 *   - reconstruir la ruta de la foto anterior para poder borrarla
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
  const require = name => realRequire(name);
  new Function('module', 'exports', 'require', output)(loadedModule, loadedModule.exports, require);
  cache.set(key, loadedModule.exports);
  return loadedModule.exports;
}

const storage = loadModule('../../src/shared/utils/storage.ts');

const SUPABASE = 'https://vafrsmzqzgfuamrrtyob.supabase.co';
const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/* ─────────────────────────────────────────────────────────────
 * Ruta de la nueva foto de perfil
 * ───────────────────────────────────────────────────────────── */

test('TDD-A01: construye la ruta de la foto dentro de la carpeta del usuario', () => {
  assert.equal(storage.PROFILE_BUCKET, 'img_perfiles');
  assert.equal(
    storage.buildAvatarPath(USER_ID, 'mi-foto.PNG', 123),
    `${USER_ID}/avatar-123.png`,
  );
  assert.equal(
    storage.buildAvatarPath(USER_ID, 'retrato.jpeg', 456),
    `${USER_ID}/avatar-456.jpeg`,
  );
});

test('TDD-A02: normaliza la extensión y cae a jpg cuando no es confiable', () => {
  // Mayúsculas y caracteres extraños se limpian.
  assert.equal(storage.buildAvatarPath(USER_ID, 'foto.JpG', 1), `${USER_ID}/avatar-1.jpg`);
  assert.equal(storage.buildAvatarPath(USER_ID, 'foto.fo to', 1), `${USER_ID}/avatar-1.foto`);
  // Sin extensión o solo un punto => jpg por defecto (nunca sin extensión).
  assert.equal(storage.buildAvatarPath(USER_ID, 'foto', 1), `${USER_ID}/avatar-1.jpg`);
  assert.equal(storage.buildAvatarPath(USER_ID, 'foto.', 1), `${USER_ID}/avatar-1.jpg`);
  assert.equal(storage.buildAvatarPath(USER_ID, null, 1), `${USER_ID}/avatar-1.jpg`);
  // Extensiones absurdamente largas tampoco pasan.
  assert.equal(storage.buildAvatarPath(USER_ID, 'foto.extensionlarguisima', 1), `${USER_ID}/avatar-1.jpg`);
});

test('TDD-A03: devuelve null si no hay identificador de usuario válido', () => {
  assert.equal(storage.buildAvatarPath('', 'foto.png', 1), null);
  assert.equal(storage.buildAvatarPath('   ', 'foto.png', 1), null);
  assert.equal(storage.buildAvatarPath(null, 'foto.png', 1), null);
  assert.equal(storage.buildAvatarPath(undefined, 'foto.png', 1), null);
  assert.equal(storage.buildAvatarPath(42, 'foto.png', 1), null);
});

/* ─────────────────────────────────────────────────────────────
 * Ruta de la foto anterior (para borrarla al cambiarla)
 * ───────────────────────────────────────────────────────────── */

test('TDD-A04: reconstruye la ruta de la foto anterior desde su URL pública', () => {
  const url = `${SUPABASE}/storage/v1/object/public/img_perfiles/${USER_ID}/avatar-123.png`;
  assert.equal(storage.storagePathFromPublicUrl(url, storage.PROFILE_BUCKET), `${USER_ID}/avatar-123.png`);
  // Una URL externa (por ejemplo, foto de Google) no se intenta borrar.
  assert.equal(
    storage.storagePathFromPublicUrl('https://lh3.googleusercontent.com/aida-public/foto.png', storage.PROFILE_BUCKET),
    null,
  );
});
