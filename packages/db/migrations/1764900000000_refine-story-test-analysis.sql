-- Up Migration

ALTER TABLE public.story_test_results
  ADD COLUMN analysis jsonb,
  ADD COLUMN analysis_version integer NOT NULL DEFAULT 1;

UPDATE public.story_test_results
SET
  analysis_version = 1,
  analysis = jsonb_build_object(
    'conclusion', status,
    'explanation', COALESCE(summary, 'Legacy summary unavailable'),
    'evidence', COALESCE(code_references, '[]'::jsonb)
  );

ALTER TABLE public.story_test_results
  ALTER COLUMN analysis_version DROP DEFAULT;

ALTER TABLE public.story_test_results
  DROP COLUMN summary,
  DROP COLUMN findings,
  DROP COLUMN issues,
  DROP COLUMN metadata,
  DROP COLUMN raw_output,
  DROP COLUMN missing_requirements,
  DROP COLUMN code_references,
  DROP COLUMN reasoning,
  DROP COLUMN loop_iterations;

COMMENT ON COLUMN public.story_test_results.analysis IS 'Versioned story analysis payload containing conclusion, evidence, and explanation.';
COMMENT ON COLUMN public.story_test_results.analysis_version IS 'Version number of the stored analysis payload.';

-- Down Migration

ALTER TABLE public.story_test_results
  ADD COLUMN summary text,
  ADD COLUMN findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN missing_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN code_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN reasoning jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN loop_iterations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN raw_output jsonb,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.story_test_results
SET
  summary = analysis ->> 'explanation',
  code_references = COALESCE(analysis -> 'evidence', '[]'::jsonb);

ALTER TABLE public.story_test_results
  DROP COLUMN analysis,
  DROP COLUMN analysis_version;


