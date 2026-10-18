# Biblioteca de Materiales — interfaz y borrado

La Biblioteca es un componente compartido (`src/shared/components/ContentLibrary.tsx`)
que se muestra en:

- `/admin/contenido` — dirección: aprueba el material de todos los cursos.
- `/teacher/contenido` — docentes: gestionan el material de sus cursos.
- `/student/biblioteca` — estudiantes: solo consultan y descargan.

## Roles y acciones

| Acción | Dirección | Docentes | Estudiantes |
| --- | --- | --- | --- |
| Ver y descargar | Sí | Sí | Sí |
| Subir material | Sí | Sí (sus cursos) | No (el botón no se muestra) |
| Eliminar material | Sí | Sí | No |

Los permisos reales viven en la base de datos (políticas RLS), no solo en la
interfaz: `resources` permite leer a los miembros del curso y escribir/eliminar
solo a dirección y docentes; el bucket `contenidos` aplica el mismo criterio
para los archivos.

## Mejoras de interfaz (iteración de octubre)

- Cabecera con contador de materiales y botón **Subir Material** solo para
  quienes pueden gestionar.
- Tarjetas rediseñadas: tipo de archivo, curso, tamaño y fecha visibles, con
  acciones claras **Abrir**, **Descargar** y **Eliminar** (antes solo había un
  icono decorativo dentro de la tarjeta).
- **Descargar** fuerza la descarga real del archivo (`?download=` en la URL
  pública de Storage).
- La búsqueda ahora también encuentra por curso, y los estados vacíos explican
  qué hacer (subir el primero o limpiar filtros).
- Aviso de confirmación al subir o eliminar, y mensaje de error con botón de
  reintento si la lista no carga.
- Vista de lista con las mismas acciones por fila.

## Borrado de materiales

1. **Eliminar** (icono de papelera) abre un modal de confirmación con el
   nombre del material; no se borra nada sin confirmar.
2. Al confirmar se elimina primero el **registro** de `resources` (la RLS solo
   lo permite a dirección y docentes; si no hubiera permisos, la interfaz
   avisa que no se eliminó nada).
3. Después se elimina el **archivo real** del bucket `contenidos`. Si el
   archivo no pudiera borrarse, el registro igual queda eliminado y el
   problema se reporta en consola (no quedan materiales «fantasma» en la
   biblioteca).
4. Los archivos con URLs externas (fuera del bucket) solo eliminan su registro.

## Migración

`supabase/migrations/20261018030000_contenidos_solo_gestion_docente.sql`:
reemplaza las políticas del bucket `contenidos` para que solo dirección y
docentes puedan subir, reemplazar y borrar archivos (antes podía cualquier
usuario autenticado). La lectura pública se mantiene. Es idempotente.

## Pruebas

| Suite | Archivo | Qué cubre |
| --- | --- | --- |
| TDD | `tests/tdd/storage_paths.test.mjs` | 4 pruebas: ruta interna del archivo desde la URL pública, decodificación, rechazo de URLs ajenas al bucket y URL de descarga directa |
| En vivo | flujo completo verificado contra la base real | subida (registro + archivo), visibilidad para docente y estudiante de la sección, bloqueo del borrado para estudiantes (registro y archivo) y borrado completo por dirección y docentes |
