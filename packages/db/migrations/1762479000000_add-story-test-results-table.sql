-- Up Migration

-- Table to store AI-evaluated results for individual stories
CREATE TABLE public.story_test_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
    status text NOT NULL CHECK (status IN ('pass', 'fail', 'blocked', 'running')),
    summary text,
    findings jsonb NOT NULL DEFAULT '[]'::jsonb,
    issues jsonb NOT NULL DEFAULT '[]'::jsonb,
    missing_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
    code_references jsonb NOT NULL DEFAULT '[]'::jsonb,
    reasoning jsonb NOT NULL DEFAULT '[]'::jsonb,
    loop_iterations jsonb NOT NULL DEFAULT '[]'::jsonb,
    raw_output jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    duration_ms integer
);

COMMENT ON TABLE public.story_test_results IS 'Detailed AI evaluation results for individual repository stories';
COMMENT ON COLUMN public.story_test_results.id IS 'Unique identifier for each story test result';
COMMENT ON COLUMN public.story_test_results.created_at IS 'The time when the test result was created';
COMMENT ON COLUMN public.story_test_results.updated_at IS 'The time when the test result was last updated';
COMMENT ON COLUMN public.story_test_results.story_id IS 'FK to stories.id of the evaluated story';
COMMENT ON COLUMN public.story_test_results.run_id IS 'Optional FK to runs.id when the test was executed as part of a CI run';
COMMENT ON COLUMN public.story_test_results.status IS 'Outcome status of the evaluation (pass, fail, blocked, running)';
COMMENT ON COLUMN public.story_test_results.summary IS 'High-level summary produced by the AI reviewer';
COMMENT ON COLUMN public.story_test_results.findings IS 'Array of key findings discovered during evaluation';
COMMENT ON COLUMN public.story_test_results.issues IS 'Array of issues or blockers preventing the story from passing';
COMMENT ON COLUMN public.story_test_results.missing_requirements IS 'Array describing missing requirements for the story to be executable';
COMMENT ON COLUMN public.story_test_results.code_references IS 'Array of code references associated with fulfilling the story';
COMMENT ON COLUMN public.story_test_results.reasoning IS 'Structured reasoning steps captured from the AI';
COMMENT ON COLUMN public.story_test_results.loop_iterations IS 'Trace of iterative AI evaluation steps';
COMMENT ON COLUMN public.story_test_results.raw_output IS 'Raw model output payload for auditing';
COMMENT ON COLUMN public.story_test_results.metadata IS 'Additional metadata captured during evaluation';
COMMENT ON COLUMN public.story_test_results.started_at IS 'Timestamp when the evaluation began';
COMMENT ON COLUMN public.story_test_results.completed_at IS 'Timestamp when the evaluation finished';
COMMENT ON COLUMN public.story_test_results.duration_ms IS 'Total evaluation duration in milliseconds';

CREATE INDEX IF NOT EXISTS story_test_results_story_id_idx ON public.story_test_results(story_id);
CREATE INDEX IF NOT EXISTS story_test_results_run_id_idx ON public.story_test_results(run_id);
CREATE INDEX IF NOT EXISTS story_test_results_status_idx ON public.story_test_results(status);

CREATE TRIGGER set_timestamp_story_test_results
BEFORE UPDATE ON public.story_test_results
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Down Migration

DROP TRIGGER IF EXISTS set_timestamp_story_test_results ON public.story_test_results;

DROP INDEX IF EXISTS public.story_test_results_status_idx;
DROP INDEX IF EXISTS public.story_test_results_run_id_idx;
DROP INDEX IF EXISTS public.story_test_results_story_id_idx;

DROP TABLE IF EXISTS public.story_test_results;


