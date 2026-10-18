import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/**
 * PRUEBAS TDD - BIBLIOTECA DE MATERIALES (borrado de archivos)
 *
 * Se carga el módulo real `src/shared/utils/storage.ts` y se verifican las
 * reglas puras que permiten borrar un material subido desde la plataforma:
 * reconstruir la ruta interna del archivo en el bucket `contenidos` a partir
 * de su URL pública (para poder borrarlo del almacenamiento) y construir la
 * URL de descarga directa.
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

/* ─────────────────────────────────────────────────────────────
 * Ruta interna del objeto (imprescindible para poder borrar)
 * ───────────────────────────────────────────────────────────── */

test('TDD-S01: extrae la ruta interna del archivo desde la URL pública del bucket', () => {
  assert.equal(storage.CONTENT_BUCKET, 'contenidos');
  assert.equal(
    storage.storagePathFromPublicUrl(`${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf`),
    'curso-prueba-4a/abc_123.pdf',
  );
  // Ignora la cadena de consulta y los fragmentos si la URL los trae.
  assert.equal(
    storage.storagePathFromPublicUrl(`${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf?download=`),
    'curso-prueba-4a/abc_123.pdf',
  );
  assert.equal(
    storage.storagePathFromPublicUrl(`${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf#vista`),
    'curso-prueba-4a/abc_123.pdf',
  );
});

test('TDD-S02: decodifica espacios y tildes del nombre del archivo', () => {
  assert.equal(
    storage.storagePathFromPublicUrl(`${SUPABASE}/storage/v1/object/public/contenidos/curso%20matem%C3%A1tica/gu%C3%ADa%201.pdf`),
    'curso matemática/guía 1.pdf',
  );
});

test('TDD-S03: devuelve null cuando la URL no pertenece al bucket (no borra objetos ajenos)', () => {
  assert.equal(storage.storagePathFromPublicUrl('https://sitio-externo.example/archivo.pdf'), null);
  assert.equal(storage.storagePathFromPublicUrl(`${SUPABASE}/storage/v1/object/public/img_cursos/foto.png`), null);
  assert.equal(storage.storagePathFromPublicUrl('curso-prueba-4a/abc_123.pdf'), null);
  assert.equal(storage.storagePathFromPublicUrl(`${SUPABASE}/storage/v1/object/public/contenidos/`), null);
  assert.equal(storage.storagePathFromPublicUrl(null), null);
  assert.equal(storage.storagePathFromPublicUrl(undefined), null);
  assert.equal(storage.storagePathFromPublicUrl(''), null);
  assert.equal(storage.storagePathFromPublicUrl(42), null);
  // Un bucket distinto al de la biblioteca tampoco coincide.
  assert.equal(
    storage.storagePathFromPublicUrl(`${SUPABASE}/storage/v1/object/public/img_perfiles/foto.png`, 'contenidos'),
    null,
  );
});

/* ─────────────────────────────────────────────────────────────
 * URL de descarga directa
 * ───────────────────────────────────────────────────────────── */

test('TDD-S04: agrega la bandera de descarga solo a los archivos del bucket', () => {
  assert.equal(
    storage.storageDownloadUrl(`${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf`),
    `${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf?download=`,
  );
  // Si la URL ya trae parámetros, la bandera se agrega con "&".
  assert.equal(
    storage.storageDownloadUrl(`${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf?v=2`),
    `${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf?v=2&download=`,
  );
  // No duplica la bandera si ya está presente.
  assert.equal(
    storage.storageDownloadUrl(`${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf?download=`),
    `${SUPABASE}/storage/v1/object/public/contenidos/curso-prueba-4a/abc_123.pdf?download=`,
  );
  // Las URLs externas se devuelven intactas.
  assert.equal(storage.storageDownloadUrl('https://sitio-externo.example/archivo.pdf'), 'https://sitio-externo.example/archivo.pdf');
  assert.equal(storage.storageDownloadUrl(null), '');
});
