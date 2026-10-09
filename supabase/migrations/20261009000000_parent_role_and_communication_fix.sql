-- Migration: 20261009000000_parent_role_and_communication_fix.sql
-- Adds: parent role, parents table, parent-teacher communication channel
-- Fixes: communication_messages channel_type to include teacher_parent

-- 1. Add 'parent' to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'parent';

-- 2. Create parents table (links parent auth user to their children)
CREATE TABLE IF NOT EXISTS public.parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    relationship TEXT NOT NULL DEFAULT 'padre' CHECK (relationship IN ('padre', 'madre', 'tutor', 'apoderado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parents_profile ON public.parents(profile_id);

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own data" ON public.parents FOR SELECT
USING (auth.uid() = profile_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')
));

CREATE POLICY "Parents can insert own data" ON public.parents FOR INSERT
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Parents can update own data" ON public.parents FOR UPDATE
USING (auth.uid() = profile_id);

GRANT ALL ON TABLE public.parents TO authenticated, service_role;
GRANT SELECT ON TABLE public.parents TO anon;

-- 3. Create parent_children table (one parent can have multiple children)
CREATE TABLE IF NOT EXISTS public.parent_children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT parent_children_unique UNIQUE (parent_profile_id, student_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON public.parent_children(parent_profile_id);
CREATE INDEX IF NOT EXISTS idx_parent_children_student ON public.parent_children(student_profile_id);

ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents/admins/teachers can view parent_children" ON public.parent_children FOR SELECT
USING (
    auth.uid() = parent_profile_id
    OR auth.uid() = student_profile_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);

CREATE POLICY "Parents and admins can insert parent_children" ON public.parent_children FOR INSERT
WITH CHECK (
    auth.uid() = parent_profile_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Parents and admins can delete parent_children" ON public.parent_children FOR DELETE
USING (
    auth.uid() = parent_profile_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

GRANT ALL ON TABLE public.parent_children TO authenticated, service_role;
GRANT SELECT ON TABLE public.parent_children TO anon;

-- 4. Drop and recreate channel_type constraint to include 'teacher_parent'
ALTER TABLE public.communication_messages
    DROP CONSTRAINT IF EXISTS communication_messages_channel_type_check;

ALTER TABLE public.communication_messages
    ADD CONSTRAINT communication_messages_channel_type_check
    CHECK (channel_type IN ('teacher_student', 'admin_teacher', 'student_parent', 'teacher_parent'));

-- 5. Update RLS policies for communication_messages to include parents
DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver mensajes donde participan o de sus cursos" ON public.communication_messages;

CREATE POLICY "Los usuarios autenticados pueden ver mensajes donde participan o de sus cursos"
ON public.communication_messages FOR SELECT
USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Grants
GRANT ALL ON TABLE public.communication_messages TO authenticated, service_role;
