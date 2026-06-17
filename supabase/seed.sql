-- Seed data for testing
-- Note: Creating users in auth.users requires internal Supabase functions if done via SQL
-- For local development, we can use these examples:

-- Admin User
-- Email: admin@infotarea.com / Password: Password123
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, recovery_token)
VALUES 
('d1234567-89ab-cdef-0123-456789abcdef', 'admin@infotarea.com', crypt('Password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Principal","role":"admin"}', now(), now(), 'authenticated', '', '');

-- Teacher User
-- Email: docente@infotarea.com / Password: Password123
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, recovery_token)
VALUES 
('e2345678-90ab-cdef-1234-567890abcdef', 'docente@infotarea.com', crypt('Password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Carlos Mendoza","role":"teacher"}', now(), now(), 'authenticated', '', '');

-- Student User
-- Email: estudiante@infotarea.com / Password: Password123
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, recovery_token)
VALUES 
('f3456789-01ab-cdef-2345-678901abcdef', 'estudiante@infotarea.com', crypt('Password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ana García","role":"student"}', now(), now(), 'authenticated', '', '');

-- Profiles are automatically created by the trigger on_auth_user_created

-- Sample Courses
INSERT INTO public.courses (id, name, section, image_url)
VALUES 
('c1234567-89ab-cdef-0123-456789abcdef', 'Matemáticas Avanzadas', 'Grupo A', 'https://images.unsplash.com/photo-1509228468518-180dd48219d1?auto=format&fit=crop&q=80&w=800'),
('c2345678-90ab-cdef-1234-567890abcdef', 'Física Cuántica', 'Grupo B', 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&q=80&w=800');

-- Assign members
INSERT INTO public.course_members (course_id, profile_id)
VALUES 
('c1234567-89ab-cdef-0123-456789abcdef', 'e2345678-90ab-cdef-1234-567890abcdef'), -- Teacher to Math
('c1234567-89ab-cdef-0123-456789abcdef', 'f3456789-01ab-cdef-2345-678901abcdef'), -- Student to Math
('c2345678-90ab-cdef-1234-567890abcdef', 'e2345678-90ab-cdef-1234-567890abcdef'); -- Teacher to Physics
