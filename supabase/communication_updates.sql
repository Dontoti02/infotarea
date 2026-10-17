-- Run once in the SQL editor of the existing InfoTarea Supabase project.
-- This patch is transactional and can be run again. It preserves existing messages.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Existing self-selected links are preserved as pending. An authorized school
-- administrator must verify each real relationship before academic access.
ALTER TABLE public.parent_children ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.parent_children ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.guard_family_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE requires_staff boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.parent_profile_id AND role = 'parent')
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.student_profile_id AND role = 'student') THEN
    RAISE EXCEPTION 'El vínculo requiere un padre y un estudiante' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    requires_staff := NEW.verified_at IS NOT NULL OR NEW.verified_by IS NOT NULL;
  ELSE
    requires_staff := ROW(NEW.parent_profile_id, NEW.student_profile_id, NEW.verified_at, NEW.verified_by)
      IS DISTINCT FROM ROW(OLD.parent_profile_id, OLD.student_profile_id, OLD.verified_at, OLD.verified_by);
  END IF;
  IF requires_staff AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo el colegio puede verificar vínculos familiares' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.verified_at IS NOT NULL THEN NEW.verified_by := auth.uid(); END IF;
  ELSIF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    NEW.verified_by := CASE WHEN NEW.verified_at IS NULL THEN NULL ELSE auth.uid() END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_family_verification() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_family_verification ON public.parent_children;
CREATE TRIGGER guard_family_verification BEFORE INSERT OR UPDATE ON public.parent_children
FOR EACH ROW EXECUTE FUNCTION private.guard_family_verification();
DROP POLICY IF EXISTS "school_verify_family_links" ON public.parent_children;
CREATE POLICY "school_verify_family_links" ON public.parent_children FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
GRANT UPDATE ON public.parent_children TO authenticated;

CREATE OR REPLACE FUNCTION private.communication_can_contact(other_id uuid, channel text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles me, public.profiles other
    WHERE me.id = (SELECT auth.uid()) AND other.id = other_id AND me.id <> other.id
    AND (
      ((channel IS NULL OR channel = 'admin_teacher') AND
        ((me.role = 'admin' AND other.role = 'teacher') OR (me.role = 'teacher' AND other.role = 'admin')))
      OR ((channel IS NULL OR channel = 'teacher_student') AND EXISTS (
        SELECT 1 FROM public.courses c JOIN public.course_members cm ON cm.course_id = c.id
        WHERE (me.role = 'teacher' AND other.role = 'student' AND c.teacher_id = me.id AND cm.profile_id = other.id)
           OR (me.role = 'student' AND other.role = 'teacher' AND c.teacher_id = other.id AND cm.profile_id = me.id)
      ))
      OR ((channel IS NULL OR channel = 'teacher_parent') AND EXISTS (
        SELECT 1 FROM public.parent_children pc
        JOIN public.course_members cm ON cm.profile_id = pc.student_profile_id
        JOIN public.courses c ON c.id = cm.course_id
        WHERE pc.verified_at IS NOT NULL AND (
          (me.role = 'parent' AND other.role = 'teacher' AND pc.parent_profile_id = me.id AND c.teacher_id = other.id)
          OR (me.role = 'teacher' AND other.role = 'parent' AND pc.parent_profile_id = other.id AND c.teacher_id = me.id))
      ))
      OR ((channel IS NULL OR channel = 'student_parent') AND EXISTS (
        SELECT 1 FROM public.parent_children pc
        WHERE pc.verified_at IS NOT NULL AND (
          (me.role = 'parent' AND other.role = 'student' AND pc.parent_profile_id = me.id AND pc.student_profile_id = other.id)
          OR (me.role = 'student' AND other.role = 'parent' AND pc.parent_profile_id = other.id AND pc.student_profile_id = me.id))
      ))
    )
  );
$$;
REVOKE ALL ON FUNCTION private.communication_can_contact(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.communication_can_contact(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.is_linked_parent_course(target_course uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.course_members cm ON cm.profile_id = pc.student_profile_id
    JOIN public.profiles p ON p.id = pc.parent_profile_id AND p.role = 'parent'
    WHERE pc.parent_profile_id = (SELECT auth.uid()) AND pc.verified_at IS NOT NULL AND cm.course_id = target_course
  );
$$;
REVOKE ALL ON FUNCTION private.is_linked_parent_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_linked_parent_course(uuid) TO authenticated;

DROP POLICY IF EXISTS "parent_read_child_memberships" ON public.course_members;
CREATE POLICY "parent_read_child_memberships" ON public.course_members FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_children pc JOIN public.profiles p ON p.id = pc.parent_profile_id AND p.role = 'parent'
  WHERE pc.parent_profile_id = (SELECT auth.uid()) AND pc.verified_at IS NOT NULL AND pc.student_profile_id = profile_id
));
DROP POLICY IF EXISTS "parent_read_child_courses" ON public.courses;
CREATE POLICY "parent_read_child_courses" ON public.courses FOR SELECT TO authenticated
USING (private.is_linked_parent_course(id));
DROP POLICY IF EXISTS "parent_read_child_tasks" ON public.tasks;
CREATE POLICY "parent_read_child_tasks" ON public.tasks FOR SELECT TO authenticated
USING (private.is_linked_parent_course(course_id));
DROP POLICY IF EXISTS "parent_read_child_submissions" ON public.submissions;
CREATE POLICY "parent_read_child_submissions" ON public.submissions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_children pc JOIN public.profiles p ON p.id = pc.parent_profile_id AND p.role = 'parent'
  WHERE pc.parent_profile_id = (SELECT auth.uid()) AND pc.verified_at IS NOT NULL AND pc.student_profile_id = student_id
));

ALTER TABLE public.communication_messages ADD COLUMN IF NOT EXISTS updated_at timestamptz;
DROP POLICY IF EXISTS "Los usuarios autenticados pueden enviar mensajes" ON public.communication_messages;
DROP POLICY IF EXISTS "communication_send_related" ON public.communication_messages;
CREATE POLICY "communication_send_related" ON public.communication_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = (SELECT auth.uid()) AND private.communication_can_contact(receiver_id, channel_type));
DROP POLICY IF EXISTS "communication_edit_own" ON public.communication_messages;
CREATE POLICY "communication_edit_own" ON public.communication_messages FOR UPDATE TO authenticated
USING (sender_id = (SELECT auth.uid())) WITH CHECK (sender_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "communication_delete_own" ON public.communication_messages;
CREATE POLICY "communication_delete_own" ON public.communication_messages FOR DELETE TO authenticated
USING (sender_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.guard_communication_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF length(btrim(NEW.content)) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'El mensaje debe tener entre 1 y 4000 caracteres' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW.sender_id, NEW.receiver_id, NEW.channel_type, NEW.course_id, NEW.created_at, NEW.title, NEW.is_read)
       IS DISTINCT FROM ROW(OLD.id, OLD.sender_id, OLD.receiver_id, OLD.channel_type, OLD.course_id, OLD.created_at, OLD.title, OLD.is_read) THEN
      RAISE EXCEPTION 'Solo se permite editar el contenido del mensaje' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := clock_timestamp();
  ELSE
    NEW.updated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_communication_message() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_communication_message ON public.communication_messages;
CREATE TRIGGER guard_communication_message BEFORE INSERT OR UPDATE ON public.communication_messages
FOR EACH ROW EXECUTE FUNCTION private.guard_communication_message();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_messages TO authenticated;
CREATE INDEX IF NOT EXISTS idx_communication_conversation
ON public.communication_messages (channel_type, sender_id, receiver_id, created_at);

CREATE TABLE IF NOT EXISTS public.communication_presence (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);
ALTER TABLE public.communication_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.communication_presence FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_presence TO authenticated;
CREATE INDEX IF NOT EXISTS idx_communication_presence_seen ON public.communication_presence (last_seen);
DROP POLICY IF EXISTS "presence_read_related" ON public.communication_presence;
CREATE POLICY "presence_read_related" ON public.communication_presence FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR private.communication_can_contact(user_id));
DROP POLICY IF EXISTS "presence_insert_own" ON public.communication_presence;
CREATE POLICY "presence_insert_own" ON public.communication_presence FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "presence_update_own" ON public.communication_presence;
CREATE POLICY "presence_update_own" ON public.communication_presence FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "presence_delete_own" ON public.communication_presence;
CREATE POLICY "presence_delete_own" ON public.communication_presence FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.touch_communication_presence()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.last_seen := clock_timestamp();
  DELETE FROM public.communication_presence WHERE user_id = NEW.user_id AND session_id <> NEW.session_id AND last_seen < now() - interval '1 day';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.touch_communication_presence() FROM PUBLIC;
DROP TRIGGER IF EXISTS touch_communication_presence ON public.communication_presence;
CREATE TRIGGER touch_communication_presence BEFORE INSERT OR UPDATE ON public.communication_presence
FOR EACH ROW EXECUTE FUNCTION private.touch_communication_presence();

-- Realtime is an acceleration; the UI also refreshes through the authenticated API.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'communication_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_messages;
  END IF;
END $$;
COMMIT;
