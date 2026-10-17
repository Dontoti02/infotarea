# Activar los cambios de comunicación

Los archivos de la aplicación y la base de datos deben actualizarse juntos.

Mientras la actualización de la base está pendiente, el panel y la comunicación toleran la ausencia de `parent_children.verified_at`: conservan los estudiantes vinculados y muestran un aviso de activación. Esta compatibilidad no considera verificados los vínculos antiguos ni habilita sus datos académicos. Los errores de permisos u otras columnas siguen siendo errores y no se ocultan.

1. En el proyecto Supabase que usa `NEXT_PUBLIC_SUPABASE_URL` en producción, ejecutar `supabase/communication_updates.sql` desde el editor SQL con una cuenta administradora. El archivo es transaccional e idempotente; conserva los mensajes existentes.
2. Comprobar las relaciones reales entre padres e hijos. Los vínculos existentes se mantienen pendientes (`parent_children.verified_at` vacío): antes los padres podían seleccionar estudiantes libremente. Una selección no constituye una verificación del colegio.
3. Una vez comprobado un vínculo concreto, el colegio puede completar `verified_at` desde el editor de tablas/SQL o con una sesión de administrador. Las sesiones de padres no pueden aprobarlo. No marcar todos los vínculos como verificados sin comprobarlos.
4. Comprobar con cuentas reales: el padre ve exclusivamente los hijos verificados con todas sus aulas y docentes; al ocultar o cerrar una pestaña deja de anunciarse esa sesión; otra pestaña abierta conserva la presencia; los mensajes ajenos no pueden editarse ni eliminarse.
5. Ejecutar `PUBLICAR-VERCEL.cmd` y esperar a que Vercel confirme un despliegue de producción correcto. El archivo de publicación envía el código, pero no aplica SQL.

La presencia se renueva cada 15 segundos, caduca a los 45 y se consulta cada 10. El cierre normal retira la sesión de inmediato; un cierre abrupto o pérdida de red caduca automáticamente. Una consulta que falle muestra estado no disponible, sin dejar un indicador en línea indefinido.

Los mensajes muestran los 100 más recientes y permiten cargar páginas anteriores. Cada envío tiene un identificador estable para reintentar después de una interrupción sin duplicarlo. Editar y eliminar exige ser el remitente tanto en la API como en RLS.

Verificación local: ejecutar `npm test`, `node node_modules/typescript/bin/tsc --noEmit` y `npm run build`. El build necesita descargar Inter y Outfit de Google Fonts, como en la configuración original.

Límites de esta entrega: no se ha podido acceder a la base remota por restricciones de red, por lo que la aplicación del SQL y las pruebas reales de RLS y varias pestañas siguen pendientes. Tampoco se han modificado los flujos previos de registro/asignación de roles; deben auditarse antes de afirmar que toda la plataforma tiene acceso restringido por el colegio.
