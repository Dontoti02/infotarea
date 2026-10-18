-- =========================================================
-- Migration: 20261018010000_recuperacion_contrasena.sql
-- Iteración Nº 4 — Recuperación de contraseña con el correo propio
--
--   1. La bitácora `email_log` admite el tipo 'password_reset'.
--   2. Nueva tabla `password_reset_requests` para limitar y auditar las
--      solicitudes de recuperación (RLS sin políticas: solo acceso elevado,
--      igual que `email_secrets`).
--
-- Idempotente: puede ejecutarse varias veces sin borrar datos existentes.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Tipos de correo registrables en la bitácora
-- ---------------------------------------------------------
ALTER TABLE public.email_log DROP CONSTRAINT IF EXISTS email_log_kind_check;
ALTER TABLE public.email_log ADD CONSTRAINT email_log_kind_check
  CHECK (kind IN ('test', 'alert_digest', 'weekly_summary', 'password_reset'));

-- ---------------------------------------------------------
-- 2. Solicitudes de recuperación (control de abuso)
--    No guarda la contraseña ni el token: solo el correo, un hash no
--    reversible del solicitante (IP) y el medio de entrega.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  requester_hash TEXT,
  delivered_via TEXT NOT NULL DEFAULT 'skipped'
    CHECK (delivered_via IN ('app_smtp', 'supabase_auth', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email
  ON public.password_reset_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_created
  ON public.password_reset_requests (created_at DESC);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
