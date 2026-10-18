# Mi Cuenta — foto, datos y contraseña por rol

La opción **Mi Cuenta** del menú de usuario (esquina superior derecha) abre un
modal editable en el layout compartido
(`src/shared/components/layout/DashboardLayout.tsx`). Está disponible para
**todos los roles** (administrador, docente, estudiante y padre de familia)
porque vive en el layout común de los paneles.

## Qué permite el modal «Mi Cuenta»

1. **Subir foto de perfil**: el botón de cámara sobre el avatar sube la imagen
   al bucket público `img_perfiles` y guarda la URL en `profiles.avatar_url`.
   - Se valida que sea una imagen y que no supere 5 MB.
   - La nueva foto se guarda como `<idUsuario>/avatar-<marca>.<ext>` y la foto
     anterior del mismo bucket se borra automáticamente (limpieza opcional).
   - El avatar del menú se actualiza al instante, sin recargar.
2. **Editar datos**: nombre completo y biografía (`profiles.full_name` y
   `profiles.bio`). El correo se muestra como referencia.
3. **Cambiar contraseña**: nueva contraseña + confirmación (mínimo 6
   caracteres), aplicada con `supabase.auth.updateUser`. Al guardar, la
   contraseña anterior deja de funcionar de inmediato.
4. Enlace **Ir a configuración avanzada** → `/{rol}/configuracion`.

## Página de configuración por rol

| Rol | Página |
| --- | --- |
| Administrador | `/admin/configuracion` |
| Docente | `/teacher/configuracion` |
| Estudiante | `/student/configuracion` |
| Padre de familia | `/parent/configuracion` (nueva) |

Todas usan el componente compartido `src/shared/components/ProfileSettings.tsx`
(pestañas Perfil, Cuenta, Notificaciones y Seguridad), así que además del modal
cada rol puede cambiar su **correo** y revisar seguridad/notificaciones. La
etiqueta del rol ahora también reconoce a «Padre de Familia».

## Permisos y almacenamiento

- `profiles`: la política «Users can update own profile» (`auth.uid() = id`)
  permite que cada persona edite solo su propia fila; aplica a los cuatro
  roles sin cambios.
- `img_perfiles`: bucket público de lectura; cualquier usuario autenticado
  puede subir/reemplazar/borrar su foto. Cada foto vive en la carpeta de su
  dueño (`<userId>/…`).
- Utilidades compartidas en `src/shared/utils/storage.ts`:
  `PROFILE_BUCKET` y `buildAvatarPath(userId, fileName)` (ruta normalizada,
  extensión saneada, `jpg` por defecto).

## Pruebas

| Suite | Archivo | Qué cubre |
| --- | --- | --- |
| TDD | `tests/tdd/avatar_paths.test.mjs` | 4 pruebas: ruta `usuario/avatar-marca.ext`, normalización de extensión, rechazo sin usuario válido y reconstrucción de la foto anterior para borrarla |
| En vivo | flujo completo contra la base real | perfil creado por el trigger, inicio de sesión, subida de foto propia a `img_perfiles`, edición de nombre/bio/foto bajo RLS, cambio de contraseña (la anterior deja de servir y la nueva funciona), `/admin|teacher|student|parent/configuracion` responden 200 y limpieza de la foto y el usuario temporales |
