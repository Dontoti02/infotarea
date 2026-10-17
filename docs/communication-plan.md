# Comunicación: plan de implementación

Objetivo: presencia real en toda la web autenticada; contactos limitados a vínculos académicos; ficha familiar con aulas y docentes reales; edición y eliminación de mensajes propios.

Restricciones: Next.js 16.2.6 y Supabase existentes; conservar mensajes previos y los cuatro roles; sin datos académicos ficticios; permisos comprobados en servidor y base de datos. Esta carpeta no contiene `.git`. No se puede crear una rama ni comparar commits aquí.

La primera instalación de dependencias falló por restricciones de red. Posteriormente aparecieron las dependencias en la carpeta y se leyeron las guías locales `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y `03-api-reference/01-directives/use-client.md`, además de la documentación oficial de v16.2.6. La compilación inicial está bloqueada por la descarga de Inter y Outfit desde Google Fonts; TypeScript sí pudo ejecutarse sin errores.

- [x] Probar funciones reales para caducidad de sesiones, aulas, vínculos y permisos de mensajes.
- [x] Incorporar presencia por sesión con latidos autenticados y cierre al ocultar/cerrar la web; varias pestañas no se desconectan entre sí.
- [x] Corregir contactos y ficha familiar: sin contactos generales de respaldo, sin sección 1A inventada, conservar todos los hijos y aulas.
- [x] Incorporar edición y eliminación propias, validar contenido y mantener el chat sincronizado sin duplicados ni respuestas de conversaciones anteriores.
- [x] Preparar SQL idempotente con RLS, permisos, índices y restricciones de actualización. No aplicar cambios a una base desconocida.
- [x] Ejecutar pruebas existentes y nuevas; intentar compilación; revisar el cambio completo. Resultado final: 52/52 pruebas; TypeScript sin errores; ESLint de los seis archivos nuevos/refactorizados sin errores. La compilación normal se intentó y falló al descargar Inter y Outfit; no se afirma un build de producción exitoso.
- [x] Ejecutar PUBLICAR-VERCEL.cmd como solicitó el usuario y comprobar el resultado real. Se ejecutó y se detuvo con EACCES al descargar la CLI; no se publicó código.

Casos de revisión: varias pestañas; pérdida de red; cambio rápido de conversación; padres con varios hijos, aulas o cursos sin docente; intento de modificar mensajes ajenos o destinos de mensajes; falta de permisos o tablas sin mostrar resultados ficticios.

## Revisión y decisiones

Revisión independiente mediante superpowers:requesting-code-review. Se corrigieron los hallazgos sobre vínculos familiares no verificados, peticiones sin plazo y consultas de historial truncadas. Se añadieron regresiones para plazos, caducidad local, reintentos idempotentes, historial reciente, verificación de hijos y precisión de cursores.

Ruling: los vínculos existentes permanecen pendientes hasta que el colegio los verifique. No hay evidencia de que cada relación actual esté validada y no se asume que lo esté. Coste: la ficha académica y los docentes de esos vínculos no se habilitan hasta su verificación.

La revisión no pudo juzgar el estado real de las políticas remotas, ejecución del SQL, ciclo de vida en navegadores reales, entrega Realtime en producción, build de producción ni publicación. Se mantienen como comprobaciones pendientes, no como resultados exitosos.

No se creó una migración con fecha inventada: la CLI de Supabase no está disponible; se entrega un parche SQL explícito y documentado. La conexión de lectura al proyecto configurado se intentó con credenciales existentes, sin mostrarlas, y falló con EACCES. No se ejecutó SQL remoto.
