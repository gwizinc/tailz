-- Up Migration

-- Remap legacy blocked statuses to fail and allow error statuses
UPDATE public.story_test_results
SET status = 'fail'
WHERE status = 'blocked';

UPDATE public.story_test_results
SET analysis = jsonb_set(analysis, '{conclusion}', '"fail"', false)
WHERE analysis IS NOT NULL
  AND analysis->>'conclusion' = 'blocked';

UPDATE public.runs
SET stories = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN story_elem ? 'status' AND story_elem->>'status' = 'blocked' THEN
          story_elem || jsonb_build_object('status', 'fail')
        ELSE
          story_elem
      END
    )
    FROM jsonb_array_elements(stories) AS story_elem
  ),
  '[]'::jsonb
)
WHERE stories::text LIKE '%"status":"blocked"%';

ALTER TABLE public.story_test_results
  DROP CONSTRAINT IF EXISTS story_test_results_status_check;

ALTER TABLE public.story_test_results
  ADD CONSTRAINT story_test_results_status_check
  CHECK (status IN ('pass', 'fail', 'running', 'error'));

COMMENT ON COLUMN public.story_test_results.status IS
  'Outcome status of the evaluation (pass, fail, running, error)';

ALTER TABLE public.runs
  DROP CONSTRAINT IF EXISTS runs_status_check;

ALTER TABLE public.runs
  ADD CONSTRAINT runs_status_check
  CHECK (status IN ('pass', 'fail', 'skipped', 'running', 'error'));

COMMENT ON COLUMN public.runs.status IS
  'The overall status of the run (pass, fail, skipped, running, error)';

-- Down Migration

UPDATE public.story_test_results
SET status = 'fail'
WHERE status = 'error';

UPDATE public.story_test_results
SET analysis = jsonb_set(analysis, '{conclusion}', '"fail"', false)
WHERE analysis IS NOT NULL
  AND analysis->>'conclusion' = 'error';

UPDATE public.runs
SET stories = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN story_elem ? 'status' AND story_elem->>'status' = 'error' THEN
          story_elem || jsonb_build_object('status', 'fail')
        ELSE
          story_elem
      END
    )
    FROM jsonb_array_elements(stories) AS story_elem
  ),
  '[]'::jsonb
)
WHERE stories::text LIKE '%"status":"error"%';

ALTER TABLE public.story_test_results
  DROP CONSTRAINT IF EXISTS story_test_results_status_check;

ALTER TABLE public.story_test_results
  ADD CONSTRAINT story_test_results_status_check
  CHECK (status IN ('pass', 'fail', 'blocked', 'running'));

COMMENT ON COLUMN public.story_test_results.status IS
  'Outcome status of the evaluation (pass, fail, blocked, running)';

ALTER TABLE public.runs
  DROP CONSTRAINT IF EXISTS runs_status_check;

ALTER TABLE public.runs
  ADD CONSTRAINT runs_status_check
  CHECK (status IN ('pass', 'fail', 'skipped', 'running'));

COMMENT ON COLUMN public.runs.status IS
  'The overall status of the run (pass, fail, skipped, running)';

