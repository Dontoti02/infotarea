# 🏗️ Arquitectura Modular — InfoTarea

## Resumen

InfoTarea sigue el patrón **Monolito Modular** (también conocido como *Modular Monolith*). A diferencia de un monolito clásico donde todo el código vive mezclado, aquí el código está dividido en **módulos de dominio** fuertemente encapsulados. A diferencia de microservicios, todo se despliega como **una sola aplicación Next.js**.

El stack técnico es:
- **Next.js 15** con App Router (React Server Components + Client Components)
- **Supabase** como backend completo (Base de datos PostgreSQL, Auth, Storage, RLS)
- **TypeScript** en todo el proyecto
- **Tailwind CSS** con sistema de tokens Material Design 3

---

## 📐 Capas de la Aplicación

La arquitectura tiene **4 capas claramente separadas**, cada una con una responsabilidad única.

```
┌──────────────────────────────────────────────────────────────┐
│   CAPA DE ENRUTAMIENTO          src/app/                     │
│   (Next.js App Router — páginas, layouts, API routes)        │
├──────────────────────────────────────────────────────────────┤
│   CAPA DE DOMINIO               src/modules/                 │
│   (Lógica de negocio y UI por rol de usuario)                │
├──────────────────────────────────────────────────────────────┤
│   CAPA COMPARTIDA               src/shared/                  │
│   (Componentes, hooks y utilidades reutilizables)            │
├──────────────────────────────────────────────────────────────┤
│   CAPA DE INFRAESTRUCTURA       src/lib/                     │
│   (Clientes de Supabase, configuración de bajo nivel)        │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Árbol Completo de la Estructura

```text
infotarea/
├── src/
│   ├── app/                          # Enrutamiento (App Router)
│   │   ├── (auth)/                   # Grupo de rutas sin layout
│   │   │   └── login, registro...
│   │   ├── admin/                    # Rutas del rol Administrador
│   │   │   ├── dashboard/
│   │   │   ├── usuarios/
│   │   │   ├── roles/
│   │   │   ├── cursos/
│   │   │   ├── tareas/
│   │   │   ├── seguimiento/
│   │   │   ├── contenido/
│   │   │   ├── avisos/
│   │   │   ├── notificaciones/
│   │   │   └── configuracion/
│   │   ├── teacher/                  # Rutas del rol Docente
│   │   │   ├── dashboard/
│   │   │   ├── cursos/
│   │   │   ├── tareas/
│   │   │   ├── entregas/
│   │   │   ├── seguimiento/
│   │   │   ├── contenido/
│   │   │   ├── avisos/
│   │   │   ├── notificaciones/
│   │   │   └── configuracion/
│   │   ├── student/                  # Rutas del rol Estudiante
│   │   │   ├── dashboard/
│   │   │   ├── cursos/
│   │   │   ├── tareas/
│   │   │   ├── entregas/
│   │   │   ├── seguimiento/
│   │   │   ├── biblioteca/
│   │   │   ├── avisos/
│   │   │   ├── notificaciones/
│   │   │   └── configuracion/
│   │   ├── api/                      # API Routes (Server-side)
│   │   │   └── admin/
│   │   │       ├── users/            # CRUD de usuarios vía Service Role
│   │   │       ├── delete-user/
│   │   │       └── bulk-import/      # Importación masiva desde Excel
│   │   ├── globals.css               # Sistema de diseño global (tokens MD3)
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Redirige según rol
│   │
│   ├── modules/                      # ★ NÚCLEO DE LA ARQUITECTURA
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   └── ForgotPasswordForm.tsx
│   │   │   ├── hooks/                # (preparado para hooks de auth)
│   │   │   └── services/             # (preparado para lógica de auth)
│   │   │
│   │   ├── teacher/
│   │   │   ├── components/
│   │   │   │   ├── TeacherDashboard.tsx     # Panel principal del docente
│   │   │   │   ├── TeacherLayout.tsx        # Layout con nav lateral
│   │   │   │   ├── TaskManagement.tsx       # Gestión de tareas
│   │   │   │   ├── TaskCreation.tsx         # Creación de tareas
│   │   │   │   ├── SubmissionManagement.tsx # Gestión de entregas
│   │   │   │   ├── SubmissionReview.tsx     # Revisión y calificación
│   │   │   │   └── TeacherAcademicTracking.tsx # Seguimiento académico
│   │   │   └── services/
│   │   │
│   │   ├── student/
│   │   │   ├── components/
│   │   │   │   ├── StudentDashboard.tsx
│   │   │   │   ├── StudentLayout.tsx
│   │   │   │   ├── StudentTaskManagement.tsx
│   │   │   │   ├── StudentSubmissions.tsx
│   │   │   │   ├── AcademicTracking.tsx
│   │   │   │   └── SubmissionManagement.tsx
│   │   │   └── services/
│   │   │
│   │   └── admin/
│   │       ├── components/
│   │       │   ├── AdminDashboard.tsx
│   │       │   ├── AdminLayout.tsx
│   │       │   ├── UserManagement.tsx       # Gestión de usuarios (más complejo)
│   │       │   ├── RoleManagement.tsx
│   │       │   ├── CreateUserForm.tsx
│   │       │   ├── CreateAdminForm.tsx
│   │       │   └── AdminAcademicTracking.tsx
│   │       └── services/
│   │
│   ├── shared/                       # Código transversal a todos los módulos
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── DashboardLayout.tsx      # Layout base compartido
│   │   │   ├── ui/                          # (espacio para componentes UI puros)
│   │   │   ├── LandingPage.tsx
│   │   │   ├── CourseList.tsx            # Lista de cursos (usada por teacher y student)
│   │   │   ├── CourseDetails.tsx         # Detalle de un curso
│   │   │   ├── ContentLibrary.tsx        # Biblioteca de contenido educativo
│   │   │   ├── NoticesCenter.tsx         # Centro de avisos y anuncios
│   │   │   └── ProfileSettings.tsx      # Configuración de perfil (todos los roles)
│   │   ├── hooks/                    # (preparado para hooks compartidos)
│   │   └── utils/                    # (preparado para utilidades compartidas)
│   │
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts             # Cliente browser (componentes cliente)
│   │       ├── server.ts             # Cliente servidor (Server Components, Actions)
│   │       └── middleware.ts         # Manejo de sesiones de Supabase
│   │
│   └── proxy.ts                      # Proxy global de Next.js 16 (auth guard)
│
├── supabase/
│   └── migrations/                   # 13 migraciones SQL versionadas
│       ├── 20260514_initial_schema   # Esquema inicial
│       ├── 20260529_temp_credentials
│       ├── 20260531_*                # Múltiples fixes de RLS y Storage
│       └── ...
│
└── assets/
    ├── logica_importacion_excel.md   # Documentación de importación Excel
    └── 1A ALUMNOS.xlsx               # Ejemplo de hoja de alumnos
```

---

## 🧩 Los 4 Módulos de Dominio

Cada módulo representa un **rol de usuario** en el sistema y es completamente independiente. Un módulo no importa código interno de otro módulo — solo puede usar lo que está en `shared/` y `lib/`.

### 1. `modules/auth` — Autenticación

Responsable de toda la lógica de acceso al sistema.

| Archivo | Responsabilidad |
|---|---|
| `LoginForm.tsx` | Formulario de inicio de sesión con Supabase Auth |
| `RegisterForm.tsx` | Registro de nuevos usuarios |
| `ForgotPasswordForm.tsx` | Recuperación de contraseña vía email |

> [!NOTE]
> La sesión es **gestionada por el middleware global** (`src/middleware.ts`), no por el módulo de auth. El módulo solo se ocupa de los formularios de entrada.

---

### 2. `modules/teacher` — Docente

Es el módulo más completo en términos de funcionalidad bidireccional (lee y escribe datos complejos).

| Componente | Función |
|---|---|
| `TeacherDashboard` | KPIs de cursos, entregas pendientes, accesos rápidos. Consulta directamente Supabase desde el cliente con `useEffect`. |
| `TeacherLayout` | Barra lateral de navegación específica del rol docente |
| `TaskManagement` | Lista y administra todas las tareas creadas |
| `TaskCreation` | Formulario de creación de tarea con soporte de adjuntos (Storage) |
| `SubmissionManagement` | Vista de todas las entregas de los estudiantes |
| `SubmissionReview` | Calificación y feedback individual de entregas |
| `TeacherAcademicTracking` | Seguimiento académico por grupo/curso |

**Patrón de datos:** Los componentes del módulo `teacher` son **Client Components** (`"use client"`) que llaman a Supabase directamente usando `createClient()` del cliente browser. La lógica de fetching vive dentro del componente con `useEffect`.

---

### 3. `modules/student` — Estudiante

Espeja funcionalmente al módulo teacher, pero desde la perspectiva del alumno.

| Componente | Función |
|---|---|
| `StudentDashboard` | Resumen de cursos, tareas pendientes y calificaciones |
| `StudentLayout` | Navegación lateral del rol estudiante |
| `StudentTaskManagement` | Lista de tareas asignadas por curso |
| `StudentSubmissions` | Historial de entregas propias |
| `SubmissionManagement` | Formulario para subir archivos a una entrega |
| `AcademicTracking` | Progreso académico del propio estudiante |

---

### 4. `modules/admin` — Administrador

El módulo con mayor impacto en el sistema. Controla usuarios, roles y datos estructurales. Sus operaciones más sensibles (crear/eliminar usuarios en Supabase Auth) se realizan a través de **API Routes** para poder usar el `service_role` de Supabase de forma segura.

| Componente | Función |
|---|---|
| `AdminDashboard` | Métricas globales del sistema |
| `AdminLayout` | Navegación lateral del rol administrador |
| `UserManagement` | CRUD completo de usuarios (el componente más grande: ~60KB) |
| `RoleManagement` | Asignación de roles a usuarios |
| `CreateUserForm` / `CreateAdminForm` | Formularios de creación de usuarios |
| `AdminAcademicTracking` | Seguimiento académico de toda la institución (~45KB) |

---

## 🔗 La Capa Compartida (`shared/`)

Contiene todo lo que es **transversal a los roles** — es decir, lo que usa más de un módulo.

```
shared/
├── components/
│   ├── layout/
│   │   └── DashboardLayout.tsx   # Layout base con sidebar, topbar, etc.
│   ├── LandingPage.tsx           # Página de bienvenida pública
│   ├── CourseList.tsx            # Lista de cursos (usada por teacher y student)
│   ├── CourseDetails.tsx         # Detalle de un curso
│   ├── ContentLibrary.tsx        # Biblioteca de contenido educativo
│   ├── NoticesCenter.tsx         # Centro de avisos y anuncios
│   └── ProfileSettings.tsx      # Configuración de perfil (todos los roles)
├── hooks/                        # (preparado para hooks reutilizables)
└── utils/                        # (preparado para utilidades reutilizables)
```

> [!IMPORTANT]
> La regla de oro: si un componente es usado por **más de un módulo**, va a `shared/`. Si es exclusivo de un solo rol, va dentro de ese `module/`.

---

## ⚙️ La Capa de Infraestructura (`lib/`)

Contiene los **tres clientes de Supabase**, que corresponden a los tres contextos de ejecución en Next.js:

```
lib/supabase/
├── client.ts      ← Para componentes "use client" (browser)
├── server.ts      ← Para Server Components y Server Actions
└── middleware.ts  ← Helper interno con updateSession() (no es la convención de archivo)
```

> [!NOTE]
> En Next.js 16, la convención de archivo cambió de `middleware.ts` → `proxy.ts` (en la raíz de `src/`). El archivo `lib/supabase/middleware.ts` es un helper interno que **no** se renombra.

| Cliente | Cuándo usarlo | Clave usada |
|---|---|---|
| `client.ts` | Componentes interactivos del lado del cliente | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `server.ts` | Server Components, API Routes, Server Actions | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies |
| `middleware.ts` | Solo en `src/middleware.ts` para refrescar tokens | Cookies de sesión |

> [!NOTE]
> Las API Routes del admin (crear/eliminar usuarios) utilizan el **Service Role Key** de Supabase, que nunca se expone al cliente. Ese key solo existe en variables de entorno del servidor.

---

## 🛡️ Seguridad y Control de Acceso

La seguridad se implementa en **dos capas**:

### 1. Proxy de Next.js 16 (`src/proxy.ts`)

```typescript
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}
```

Se ejecuta en **cada request** antes de renderizar la página. Refresca automáticamente el token de sesión de Supabase y redirige a login si la sesión expiró. En Next.js 16 el archivo `middleware.ts` fue renombrado a `proxy.ts` y la función exportada de `middleware` a `proxy`.

### 2. Row Level Security (RLS) en PostgreSQL

Las **13 migraciones SQL** en `supabase/migrations/` construyen progresivamente las políticas de seguridad a nivel de base de datos:

| Migración | Propósito |
|---|---|
| `20260514_initial_schema` | Esquema base: `profiles`, `courses`, `tasks`, `submissions` |
| `20260531_fix_course_members_rls` | Políticas RLS para membresía a cursos |
| `20260531_fix_tasks_submissions_rls` | Políticas de lectura/escritura en tareas y entregas |
| `20260531_teacher_course_policies` | Docentes solo ven sus cursos asignados |
| `20260531_fix_courses_rls_recursion` | Corrección de recursión infinita en policies |
| `20260531_sync_students_to_courses` | Sincronización automática de alumnos |
| `20260531_add_attachment_to_tasks` | Soporte de adjuntos en tareas |
| `20260531_add_files_to_submissions` | Soporte de archivos en entregas |
| `20260531_setup_storage_bucket` | Bucket de Storage para archivos |
| `20260531_fix_storage_policies` | Políticas de acceso al Storage |

> [!CAUTION]
> Las políticas RLS son la **última línea de defensa**. Aunque el frontend tenga bugs, un usuario no podrá leer ni escribir datos que no le corresponden porque PostgreSQL lo bloquea directamente.

---

## 🔄 Flujo de Datos Típico

### Ejemplo: Docente carga su dashboard

```
Browser (TeacherDashboard.tsx)
  │
  ├─ useEffect() se ejecuta al montar
  │
  ├─ createClient()  ←  lib/supabase/client.ts
  │     └─ Crea cliente browser con anon key
  │
  ├─ supabase.auth.getUser()
  │     └─ Verifica sesión activa (si no hay → middleware redirige)
  │
  ├─ supabase.from("courses").select(...)
  │     └─ Supabase aplica RLS → solo devuelve cursos del docente
  │
  ├─ supabase.from("tasks").select(...)
  │     └─ RLS filtra solo tareas de los cursos del docente
  │
  └─ setLoading(false) → React renderiza los KPIs y la lista de cursos
```

### Ejemplo: Admin crea un usuario nuevo

```
Browser (CreateUserForm.tsx)
  │
  ├─ fetch("/api/admin/users", { method: "POST", body: userData })
  │
  └─ src/app/api/admin/users/route.ts (Server)
        │
        ├─ createClient() con service_role key (nunca expuesto al cliente)
        │
        ├─ supabase.auth.admin.createUser({ email, password, ... })
        │
        └─ supabase.from("profiles").insert({ role, full_name, ... })
```

---

## 🗺️ Diagrama de Capas

```mermaid
graph TD
    Browser["🌐 Browser / Usuario"]
    MW["🔒 Middleware\nsrc/middleware.ts\n(Refresca sesión)"]
    AppRouter["📂 App Router\nsrc/app/\n(teacher/ student/ admin/)"]
    Modules["🧩 Módulos de Dominio\nsrc/modules/\n(teacher | student | admin | auth)"]
    Shared["🔗 Shared\nsrc/shared/\n(componentes transversales)"]
    Lib["⚙️ Infraestructura\nsrc/lib/supabase/\n(client | server | middleware)"]
    API["🛠️ API Routes\nsrc/app/api/admin/\n(users | bulk-import | delete-user)"]
    Supabase["🗄️ Supabase\n(PostgreSQL + Auth + Storage)"]

    Browser -->|Request| MW
    MW -->|Sesión válida| AppRouter
    AppRouter -->|Renderiza| Modules
    Modules -->|Usa| Shared
    Modules -->|createClient()| Lib
    AppRouter -->|Operaciones admin| API
    Lib -->|Queries con RLS| Supabase
    API -->|service_role| Supabase
```

---

## ✅ Beneficios de esta Arquitectura

| Beneficio | Cómo se logra |
|---|---|
| **Separación de responsabilidades** | Cada rol tiene su propio módulo aislado |
| **Escalabilidad** | Agregar un módulo nuevo no afecta a los existentes |
| **Seguridad por defecto** | RLS garantiza aislamiento de datos a nivel DB |
| **Desarrollo en equipo** | Cada developer puede trabajar en un módulo sin conflictos |
| **Simplicidad de despliegue** | Un solo proyecto Next.js, un solo Supabase project |
| **Mantenibilidad** | Si hay un bug en el módulo `teacher`, no afecta a `student` ni `admin` |

---

## 🚀 Cómo Agregar un Nuevo Módulo

Siguiendo el patrón establecido, para agregar un módulo `coordinator` (por ejemplo):

1. Crear `src/modules/coordinator/components/` y `services/`
2. Definir los tipos en un `types.ts` dentro del módulo
3. Crear el layout `CoordinatorLayout.tsx` y el dashboard `CoordinatorDashboard.tsx`
4. Agregar las rutas en `src/app/coordinator/`
5. Agregar el middleware de protección de ruta si es necesario
6. Crear las políticas RLS en una nueva migración SQL
