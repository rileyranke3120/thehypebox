-- Atomic JSONB merge for onboarding checklist steps.
-- Replaces the read-modify-write pattern in /api/checklist to eliminate race conditions.
-- The || operator in Postgres merges two JSONB objects atomically in a single UPDATE.

CREATE OR REPLACE FUNCTION set_onboarding_step(p_user_id uuid, p_step text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE users
  SET onboarding_checklist = COALESCE(onboarding_checklist, '{}'::jsonb) || jsonb_build_object(p_step, true)
  WHERE id = p_user_id;
$$;
