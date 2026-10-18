-- =========================================================
-- Migration: 20261018000000_iteracion_4_priorizacion_correo.sql
-- Iteración Nº 4 - Cuarta entrega incremental
--
--   21. Estructura de datos para priorización de tareas y generación de avisos.
--   22. Alertas del componente inteligente (clasificación y resúmenes de entregas).
--   23. Configuración del correo saliente (SMTP) y bitácora de envíos.
--
-- Idempotente: puede ejecutarse varias veces sin borrar datos existentes.
-- =========================================================

-- ---------------------------------------------------------
-- 0. Helper de permisos (se recrea por seguridad; ya existe
--    en la migración 20260531040000_fix_courses_rls_recursion)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_course_teacher(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses
    WHERE id = p_course_id
      AND teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------
-- 1. Reglas de avisos y priorización (configurable por la dirección)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_rules (
  rule_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan reglas de notificación" ON public.notification_rules;
CREATE POLICY "Admins gestionan reglas de notificación"
ON public.notification_rules FOR ALL
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

INSERT INTO public.notification_rules (rule_key, label, description, enabled, config)
VALUES
  ('task_due_soon', 'Tarea próxima a vencer',
   'Avisa a estudiantes y docentes cuando una tarea vence dentro de la ventana configurada.',
   TRUE, '{"hours": 48}'::jsonb),
  ('task_overdue', 'Tarea vencida sin entrega',
   'Avisa cuando la fecha límite pasó y hay estudiantes sin entregar. Se genera una vez por tarea.',
   TRUE, '{}'::jsonb),
  ('submission_pending_review', 'Entregas por revisar',
   'Avisa al docente cuando sus entregas llevan demasiado tiempo sin calificar.',
   TRUE, '{"hours": 48}'::jsonb),
  ('student_at_risk', 'Estudiante en riesgo',
   'Avisa cuando un estudiante baja del promedio mínimo o acumula tareas vencidas.',
   TRUE, '{"average": 5, "overdue": 2}'::jsonb),
  ('weekly_summary', 'Resumen semanal',
   'Envía un resumen de indicadores a la dirección cada semana.',
   TRUE, '{}'::jsonb)
ON CONFLICT (rule_key) DO NOTHING;

-- ---------------------------------------------------------
-- 2. Correo saliente (una sola fila). La contraseña NO se
--    guarda aquí: vive en public.email_secrets, sin políticas
--    de lectura para sesiones normales.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_security TEXT NOT NULL DEFAULT 'tls' CHECK (smtp_security IN ('tls', 'ssl', 'none')),
  smtp_user TEXT,
  from_email TEXT,
  from_name TEXT,
  reply_to TEXT,
  alert_config JSONB NOT NULL DEFAULT '{
    "task_due_soon": true,
    "task_overdue": true,
    "submission_pending_review": true,
    "student_at_risk": true,
    "weekly_summary": true
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen el correo saliente" ON public.email_settings;
CREATE POLICY "Admins leen el correo saliente"
ON public.email_settings FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins registran el correo saliente" ON public.email_settings;
CREATE POLICY "Admins registran el correo saliente"
ON public.email_settings FOR INSERT
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins actualizan el correo saliente" ON public.email_settings;
CREATE POLICY "Admins actualizan el correo saliente"
ON public.email_settings FOR UPDATE
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

INSERT INTO public.email_settings (id, enabled, smtp_host, smtp_port, smtp_security)
VALUES (TRUE, FALSE, 'smtp.gmail.com', 587, 'tls')
ON CONFLICT (id) DO NOTHING;

-- Contraseña de aplicación. RLS habilitado SIN políticas:
-- solo la clave de servicio (o una conexión directa de confianza)
-- puede leerla o escribirla. Nunca llega al navegador.
CREATE TABLE IF NOT EXISTS public.email_secrets (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  smtp_password TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_secrets ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- 3. Bitácora de envíos
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_ids UUID[] NOT NULL DEFAULT '{}',
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'alert_digest' CHECK (kind IN ('test', 'alert_digest', 'weekly_summary')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_to ON public.email_log (to_email);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen la bitácora de correos" ON public.email_log;
CREATE POLICY "Admins leen la bitácora de correos"
ON public.email_log FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins registran la bitácora de correos" ON public.email_log;
CREATE POLICY "Admins registran la bitácora de correos"
ON public.email_log FOR INSERT
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ---------------------------------------------------------
-- 4. Alertas inteligentes generadas por el motor de reglas
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.smart_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'task_due_soon', 'task_overdue', 'submission_pending_review', 'student_at_risk', 'weekly_summary'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critica', 'alta', 'media', 'informativa')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  email_status TEXT NOT NULL DEFAULT 'not_sent' CHECK (email_status IN ('not_sent', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_alerts_created ON public.smart_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_alerts_type ON public.smart_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_smart_alerts_status ON public.smart_alerts (status);
CREATE INDEX IF NOT EXISTS idx_smart_alerts_student ON public.smart_alerts (student_id);
CREATE INDEX IF NOT EXISTS idx_smart_alerts_course ON public.smart_alerts (course_id);

ALTER TABLE public.smart_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan alertas inteligentes" ON public.smart_alerts;
CREATE POLICY "Admins gestionan alertas inteligentes"
ON public.smart_alerts FOR ALL
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Docentes ven alertas de sus cursos" ON public.smart_alerts;
CREATE POLICY "Docentes ven alertas de sus cursos"
ON public.smart_alerts FOR SELECT
USING (
  (course_id IS NOT NULL AND public.is_course_teacher(course_id))
  OR EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.course_members cm ON cm.course_id = c.id
    WHERE c.teacher_id = auth.uid() AND cm.profile_id = smart_alerts.student_id
  )
);

DROP POLICY IF EXISTS "Estudiantes ven sus propias alertas" ON public.smart_alerts;
CREATE POLICY "Estudiantes ven sus propias alertas"
ON public.smart_alerts FOR SELECT
USING (student_id = auth.uid());
