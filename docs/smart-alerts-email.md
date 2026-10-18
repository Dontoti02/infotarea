# Iteración Nº 4 — Priorización, componente inteligente y correo saliente

Cuarta entrega incremental de InfoTarea: reglas de priorización de tareas, un
componente inteligente de clasificación y resúmenes de entregas, y un servicio
de correo con alertas automáticas de seguimiento académico.

| Ítem del plan | Qué entrega | Dónde vive |
| --- | --- | --- |
| 21. Reglas y estructuras para priorizar tareas y generar avisos | Reglas puras (puntaje, nivel, motivos), claves de deduplicación y catálogo de avisos | `src/shared/utils/prioritization.ts` |
| 22. Componente inteligente integrado con Supabase | Clasificación de tareas, resúmenes de entregas, métricas y panel de seguimiento | `src/modules/smart/` (`services/smartService.ts`, `components/SmartSummaryPanel.tsx`) |
| 23. Servicio de correo y alertas automáticas | Configuración SMTP en la base de datos, envío de pruebas, resúmenes y recuperación de contraseña, motor de alertas y cron | `src/modules/smart/services/emailService.ts`, `alertEngine.ts`, `adminData.ts`, `src/app/api/admin/email-*`, `src/app/api/alerts/sweep`, `src/app/api/auth/recovery`, `src/app/auth/confirm` |

Documentos relacionados: `docs/communication-plan.md` (iteración 3) y
`docs/communication-deployment.md` (despliegue de comunicaciones).

---

## 1. Reglas de priorización (ítem 21)

Cada tarea recibe un puntaje determinista y un nivel (`critica`, `alta`,
`media`, `baja`) con motivos legibles. Pesos vigentes en
`DEFAULT_PRIORITY_RULES`:

| Factor | Puntaje |
| --- | --- |
| Tipo de actividad | examen 30 · tarea 20 · foro 10 |
| Vencimiento | vencida +40 · ventana urgente (≤ 24 h) +30 · próxima (≤ 48 h) +20 · esta semana +10 · lejana +5 |
| Entregas | sin entregas +15 · pendientes de revisar +5 · todas revisadas −10 |

Umbrales de nivel: **crítica ≥ 70**, **alta ≥ 50**, **media ≥ 30**, el resto
baja. Las reglas son puras: reciben `now` y la configuración por parámetro, por
lo que se prueban con TDD sin tocar la base de datos.

Niveles de riesgo de un estudiante (`buildDeliverySummary`), alineados con el
seguimiento que ya usa la dirección:

| Nivel | Condición |
| --- | --- |
| `en_riesgo` | promedio < 5 o ≥ 2 tareas vencidas sin entrega |
| `observacion` | promedio < 7 o ≥ 1 tarea vencida |
| `sin_actividad` | cero entregas registradas |
| `al_dia` | cualquier otro caso |

## 2. Avisos y alertas (ítems 21 y 23)

`buildAlertCandidates` genera los avisos del día con clave única de
deduplicación (`smart_alerts.dedupe_key` es `UNIQUE` e `INSERT ... ON CONFLICT
DO NOTHING`, de modo que ejecutar el motor dos veces no duplica nada):

| Alerta | Cuándo se genera | Audiencia | Clave de deduplicación |
| --- | --- | --- | --- |
| `task_due_soon` | la tarea vence dentro de la ventana (48 h por defecto) y hay estudiantes pendientes | estudiantes pendientes, docente y dirección | `due_soon:<tarea>:<YYYY-MM-DD>` |
| `task_overdue` | la fecha límite pasó y hay estudiantes sin entregar | estudiantes pendientes, docente y dirección | `overdue:<tarea>` (una sola vez) |
| `submission_pending_review` | una entrega lleva más de 48 h sin calificar | docente y dirección | `pending_review:<curso>:<YYYY-MM-DD>` |
| `student_at_risk` | promedio bajo o tareas vencidas acumuladas | por correo: docentes del aula y padres vinculados (dentro del sistema lo ven el alumno, la familia en su panel y la dirección) | `at_risk:<estudiante>:<AAAA-Sss>` (semana ISO) |
| `weekly_summary` | resumen semanal de indicadores | dirección | `weekly_summary:<AAAA-Sss>` |

La tabla `notification_rules` permite ajustar horas y umbrales sin recompilar:
`task_due_soon.hours`, `submission_pending_review.hours`,
`student_at_risk.average` y `student_at_risk.overdue`. La columna `enabled`
apaga la generación de cada tipo de alerta.

Cada alerta llega a su audiencia por **dos canales**:

- **Dentro del sistema**: la dirección y los docentes las ven en el panel del
  componente inteligente (`/admin/seguimiento` y `/teacher/seguimiento`); el
  estudiante ve las suyas en `/student/seguimiento` (tarjeta *Avisos de
  seguimiento académico*, con el título en segunda persona «Tu rendimiento
  requiere atención»), en la campana del encabezado y en
  `/student/notificaciones`. La política de RLS *Estudiantes ven sus propias
  alertas* garantiza que cada alumno solo lee sus propias filas. Las familias
  ven las de sus hijos en su ficha familiar (`/parent/dashboard`): la política
  *Padres ven las alertas de sus hijos* (migración
  `20261018020000_padres_ven_alertas.sql`) limita a cada padre a las filas de
  sus hijos vinculados; el panel familiar las muestra junto al resto de datos
  académicos solo cuando el vínculo está verificado.
- **Por correo**: un único resumen priorizado por destinatario según la
  audiencia de cada alerta, cuando el correo está activo y el destinatario
  tiene correo registrado. En el aviso de **bajo rendimiento**
  (`student_at_risk`) los destinatarios del correo son **solo los docentes del
  aula y los padres vinculados** (tabla `parent_children`): el nombre del
  estudiante viaja en el asunto y en el cuerpo para que cada familia reconozca
  a su hijo. El propio alumno no recibe correo (ve su aviso dentro del
  sistema) y la dirección recibe ese caso en el panel y en su resumen semanal.

La lectura de los avisos del estudiante vive en `loadStudentAlerts`
(`src/modules/smart/services/smartService.ts`); si la migración aún no está
aplicada devuelve una lista vacía en lugar de romper la interfaz.

## 3. Componente inteligente (ítem 22)

`loadSmartOverview` combina tareas, entregas, cursos y alertas visibles según
el rol (dirección ve todo; docentes ven sus cursos y sus estudiantes) y produce:

- **Clasificación**: lista de tareas ordenada por prioridad con motivos.
- **Resúmenes de entregas**: por estudiante (avance, promedio, pendientes,
  vencidas y nivel de riesgo).
- **Métricas**: tareas totales, críticas, próximas a vencer, vencidas, entregas
  por revisar, estudiantes en riesgo y promedio general.
- **Alertas guardadas** en `smart_alerts` con su estado de correo.

Se muestra en:

- `/admin/seguimiento` — dirección; incluye el botón **Ejecutar alertas ahora**.
- `/teacher/seguimiento` — docentes, con el alcance de sus cursos.
- `/parent/dashboard` — familias, con los avisos del hijo activo (política
  *Padres ven las alertas de sus hijos*).

## 4. Correo saliente y alertas automáticas (ítem 23)

### 4.1 Configuración desde la plataforma

En **Configuración → Correo saliente** (`/admin/configuracion`) la dirección
registra el servidor SMTP, la seguridad, el puerto, el usuario, la contraseña
de aplicación y el remitente; también elige qué alertas se envían por correo y
puede enviar un **correo de prueba**.

La contraseña nunca viaja al navegador: se guarda en `public.email_secrets`,
que tiene RLS habilitado **sin políticas**, de modo que solo la clave de
servicio (o una conexión directa de confianza) puede leerla. La interfaz solo
sabe si existe (`hasPassword`).

### 4.2 Gmail con contraseña de aplicación

1. Activa la **verificación en dos pasos** en la cuenta de Google institucional.
2. Entra a **Cuenta de Google → Seguridad → Contraseñas de aplicaciones**.
3. Crea una contraseña de aplicación para "Correo" y copia el código de 16
   caracteres.
4. En InfoTarea usa `smtp.gmail.com`, seguridad **TLS** y puerto **587**
   (o **SSL** con **465**), tu correo completo como usuario y el código como
   contraseña. La plataforma valida esta combinación y guarda el código sin
   espacios.

> La contraseña normal de la cuenta no funciona para SMTP: Gmail exige la
> contraseña de aplicación cuando la verificación en dos pasos está activa.

### 4.3 Acceso elevado a datos

`src/modules/smart/services/adminData.ts` intenta primero la clave de servicio
de Supabase (`SUPABASE_SERVICE_ROLE_KEY`) y, si no está configurada o falla,
cae a una conexión `pg` con `DATABASE_URL`. Variables opcionales:

| Variable | Uso |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | backend principal para leer/escribir la contraseña y las alertas; **obligatoria** para enviar la recuperación de contraseña por la cuenta Gmail de la institución |
| `DATABASE_URL` | conexión directa de respaldo (solo servidor) |
| `ALERTS_CRON_SECRET` o `CRON_SECRET` | token `Bearer` para que el cron ejecute el motor sin sesión |
| `NEXT_PUBLIC_SITE_URL` (opcional) | dominio público usado en los enlaces de los correos |
| `RECOVERY_IP_SALT` (opcional) | sal del hash del solicitante en `password_reset_requests` |

### 4.4 API

| Ruta | Métodos | Respuestas |
| --- | --- | --- |
| `/api/admin/email-settings` | `GET`, `PUT` | 401 sin sesión · 403 si no es dirección · 400 configuración inválida · 503 migración pendiente o fallo de lectura · 502 si la configuración se guardó pero la contraseña falló |
| `/api/admin/email-test` | `POST` | 401 · 403 · 400 destino o correo incompletos · 502 fallo SMTP · 503 migración pendiente |
| `/api/alerts/sweep` | `POST`, `GET` | 401 · 403 · 200 con resumen (nuevas, repetidas, enviadas, fallidas) · 500 error inesperado · 503 migración pendiente o backend no disponible |
| `/api/auth/recovery` | `POST` | 400 correo inválido · 200 genérico (siempre, incluso con límite alcanzado o cuenta inexistente) · 502 fallo de envío o de GoTrue |
| `/auth/confirm` | `GET`, `POST` | `GET` muestra la página de confirmación sin gastar el token (protege de los escáneres de correo) · `POST` verifica: 303 a `/update-password` con token válido o a `/forgot-password?error=enlace` si el enlace venció o fue alterado |

### 4.5 Automatización diaria

`vercel.json` programa `/api/alerts/sweep` todos los días a las 11:00 UTC.
Vercel Cron llama con `GET`, y la autorización acepta un administrador
autenticado o el encabezado `Authorization: Bearer $ALERTS_CRON_SECRET`.
Para ejecutarlo manualmente (por ejemplo desde otro programador de tareas):

```bash
curl -X POST https://<tu-dominio>/api/alerts/sweep \
  -H "Authorization: Bearer $ALERTS_CRON_SECRET"
```

## 5. Recuperación de contraseña desde el inicio de sesión (ítem 23 ampliado)

En **Iniciar sesión → "Olvidé mi contraseña"** (`/forgot-password`) la persona
escribe su correo y recibe un enlace para crear una nueva contraseña. El correo
sale por la **misma cuenta Gmail de la institución** configurada en «Correo
saliente», con la marca de la plataforma.

Flujo con el correo propio (recomendado):

1. `POST /api/auth/recovery` valida el correo y aplica el límite de abuso
   (3 solicitudes por correo y 10 por solicitante cada hora en
   `password_reset_requests`).
2. GoTrue emite un token de un solo uso (`auth.admin.generateLink`) y la
   plataforma envía el correo con la plantilla `renderPasswordResetEmail`.
3. El enlace apunta a `/auth/confirm`: el `GET` solo muestra una página intermedia (así los escáneres de Gmail/Outlook no consumen el token antes de que la persona lo abra) y el formulario la envía por `POST`, que verifica el token con `verifyOtp({ type: 'recovery' })` y crea la sesión de recuperación en cookies.
4. `/update-password` pide la nueva contraseña (mínimo 8 caracteres, medidor de
   fortaleza, confirmación y mostrar/ocultar), la guarda con `updateUser`,
   cierra la sesión y regresa a `/login` con el aviso de éxito.

Detalles de seguridad y experiencia:

- **Sin enumeración de cuentas**: la respuesta siempre es genérica, exista o no
  el correo, y el límite de solicitudes responde igual (no se envía otro
  correo).
- **Sin redirecciones abiertas**: el parámetro `next` solo acepta rutas
  internas (`safeInternalPath`).
- **Privacidad**: `password_reset_requests` guarda solo el correo, un hash no
  reversible del solicitante y el medio de entrega; nunca el token ni la
  contraseña.
- **Vigencia del enlace**: 60 minutos por defecto; se ajusta en Supabase →
  Authentication → Providers → Email («Email OTP Expiration»). El botón
  «Reenviar enlace» se habilita tras 60 s y cada enlace nuevo reemplaza a los
  anteriores (usa siempre el más reciente).
- **Bitácora**: cada envío de recuperación queda en `email_log`
  (`kind = 'password_reset'`, estado `sent`/`failed`).

> La recuperación por la cuenta propia exige `SUPABASE_SERVICE_ROLE_KEY`
> (GoTrue no permite emitir tokens sin la clave de servicio). Sin ella, la
> plataforma usa el **correo estándar de Supabase** como respaldo: la persona
> recibe el enlace, pero con la plantilla de Supabase y solo si el panel del
> proyecto tiene SMTP configurado.

## 6. Puesta en marcha

1. **Aplica la migración** `supabase/migrations/20261018000000_iteracion_4_priorizacion_correo.sql`
   (Supabase → SQL Editor, o `supabase db push`). Es idempotente: crea
   `notification_rules`, `email_settings`, `email_secrets`, `email_log` y
   `smart_alerts` con sus políticas e índices, y siembra los valores por
   defecto. Sin ella la interfaz avisa "migración pendiente" y las rutas
   responden 503.
2. **Aplica la migración** `supabase/migrations/20261018010000_recuperacion_contrasena.sql`:
   amplía `email_log` con `password_reset` y crea `password_reset_requests`.
3. **Aplica la migración** `supabase/migrations/20261018020000_padres_ven_alertas.sql`:
   añade la política *Padres ven las alertas de sus hijos* para que la ficha
   familiar muestre los avisos del hijo activo.
4. Configura `SUPABASE_SERVICE_ROLE_KEY` (necesaria para el correo propio de
   recuperación; `DATABASE_URL` sirve de respaldo para el resto) y el secreto
   del cron en el entorno del servidor.
5. Entra como dirección a **Configuración → Correo saliente**, activa el envío,
   guarda la cuenta y envía un correo de prueba.
6. Abre **Seguimiento** y pulsa **Ejecutar alertas ahora** para generar la
   primera tanda; después deja que el cron haga el trabajo diario.
7. Prueba **"Olvidé mi contraseña"** desde el inicio de sesión con una cuenta
   real: debe llegar el correo con el enlace y el cambio debe terminar con el
   aviso "Tu contraseña se actualizó correctamente".

No hace falta `npm install` adicional: `nodemailer` ya está en
`package.json`.

## 7. Pruebas

| Suite | Archivo | Qué cubre |
| --- | --- | --- |
| TDD | `tests/tdd/prioritization.test.mjs` | 16 pruebas de reglas puras, claves de deduplicación, validación SMTP, agrupación de correos y aviso de bajo rendimiento por correo solo a docentes y padres (con el nombre del estudiante) |
| TDD | `tests/tdd/password_recovery.test.mjs` | 6 pruebas de recuperación: correo, enlaces seguros, fortaleza y límites |
| Integración | `tests/integration/email_routes.test.mjs` | 13 pruebas de las rutas reales con Supabase y SMTP simulados: sesión, rol, validación, migración pendiente, contraseñas (guardar/borrar) y cron |
| Integración | `tests/integration/student_alerts.test.mjs` | 4 pruebas de `loadStudentAlerts`: filtro por el propio estudiante, orden por fecha, límite configurable y manejo de migración pendiente/errores |
| Integración | `tests/integration/parent_alerts.test.mjs` | 4 pruebas de `loadChildAlerts`: avisos del hijo activo en el panel familiar (política «Padres ven las alertas de sus hijos»), orden por fecha, límite configurable y migración pendiente/errores |
| Integración | `tests/integration/recovery_routes.test.mjs` | 14 pruebas de `/api/auth/recovery` y `/auth/confirm`: genérico sin enumeración, envío propio, respaldo Supabase, límite, fallos, página de confirmación anti-escáneres (GET/POST) y destinos seguros |
| Aceptación | `tests/acceptance/smart_alerts_acceptance.test.mjs` | 7 escenarios BDD de los ítems 21–23 con el módulo real, incluido el aviso de bajo rendimiento (dentro del sistema para el alumno; por correo solo a docentes y padres) |
| Aceptación | `tests/acceptance/password_recovery_acceptance.test.mjs` | 3 escenarios BDD del ciclo completo de recuperación de contraseña |

```bash
npm test
```
