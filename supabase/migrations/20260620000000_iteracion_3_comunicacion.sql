-- Migration: 20260620000000_iteracion_3_comunicacion.sql
-- Iteración Nº 3 - Tercera entrega incremental
-- 12. Comunicación Docente-Estudiante: chat y flujo principal
-- 13. Comunicación Administrador-Docente: avisos y mensajes
-- 14. Comunicación Estudiante-Padre: habilitación progresiva del flujo

-- 1. Tabla de Mensajería Institucional y Chats
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('teacher_student', 'admin_teacher', 'student_parent')),
    title TEXT,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_comm_messages_sender ON public.communication_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_comm_messages_receiver ON public.communication_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_comm_messages_channel ON public.communication_messages(channel_type);
CREATE INDEX IF NOT EXISTS idx_comm_messages_course ON public.communication_messages(course_id);

-- RLS para communication_messages
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios autenticados pueden ver mensajes donde participan o de sus cursos"
ON public.communication_messages FOR SELECT
USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id 
    OR receiver_id IS NULL
    OR (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
);

CREATE POLICY "Los usuarios autenticados pueden enviar mensajes"
ON public.communication_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id
);

-- 2. Tabla de Vinculación y Habilitación Progresiva Estudiante-Padre
CREATE TABLE IF NOT EXISTS public.parent_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    progressive_stage INT NOT NULL DEFAULT 1 CHECK (progressive_stage IN (1, 2, 3)),
    share_grades BOOLEAN NOT NULL DEFAULT true,
    share_tasks BOOLEAN NOT NULL DEFAULT true,
    share_attendance BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'active')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT parent_student_links_student_id_unique UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_student_student ON public.parent_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_invite ON public.parent_student_links(invite_code);

-- RLS para parent_student_links
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estudiantes y administradores pueden ver sus vínculos familiares"
ON public.parent_student_links FOR SELECT
USING (
    auth.uid() = student_id
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Estudiantes y administradores pueden insertar o modificar vínculos"
ON public.parent_student_links FOR ALL
USING (
    auth.uid() = student_id
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Permisos para Data API
GRANT ALL ON TABLE public.communication_messages TO authenticated, service_role;
GRANT SELECT ON TABLE public.communication_messages TO anon;

GRANT ALL ON TABLE public.parent_student_links TO authenticated, service_role;
GRANT SELECT ON TABLE public.parent_student_links TO anon;

