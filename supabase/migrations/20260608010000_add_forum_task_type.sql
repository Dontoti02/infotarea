-- ================================================================
-- Add 'forum' to task_type enum and deprecate 'essay'
-- ================================================================
-- PostgreSQL requires ALTER TYPE to add new enum values.
-- We cannot remove 'essay' from the enum without recreating it,
-- so we leave it in the DB but remove it from the UI.
-- ================================================================

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'forum';
