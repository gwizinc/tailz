-- Up Migration

-- Story evidence cache table to store file hashes per step/assertion
CREATE TABLE public.story_evidence_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    branch_name text NOT NULL,
    story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    commit_sha text NOT NULL,
    cache_data jsonb NOT NULL,
    run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.story_evidence_cache IS 'Cache of file hashes for story evaluation evidence to avoid re-running CI when files unchanged';
COMMENT ON COLUMN public.story_evidence_cache.id IS 'Unique identifier for each cache entry';
COMMENT ON COLUMN public.story_evidence_cache.created_at IS 'The time when the cache entry was created';
COMMENT ON COLUMN public.story_evidence_cache.updated_at IS 'The time when the cache entry was last updated';
COMMENT ON COLUMN public.story_evidence_cache.branch_name IS 'The branch name this cache entry is for';
COMMENT ON COLUMN public.story_evidence_cache.story_id IS 'FK to stories.id of the story this cache belongs to';
COMMENT ON COLUMN public.story_evidence_cache.commit_sha IS 'The commit SHA this cache entry is for - allows keeping cache from older states';
COMMENT ON COLUMN public.story_evidence_cache.cache_data IS 'Nested structure: { steps: { "0": { assertions: { "0": { filename: hash } } } } }';
COMMENT ON COLUMN public.story_evidence_cache.run_id IS 'FK to runs.id - metadata about which run produced this cache';

-- Unique constraint on (story_id, commit_sha) - one cache entry per story/commit combination
-- This allows keeping cache from older commits when branches require older states
CREATE UNIQUE INDEX story_evidence_cache_story_commit_unique_idx ON public.story_evidence_cache(story_id, commit_sha);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS story_evidence_cache_story_id_idx ON public.story_evidence_cache(story_id);
CREATE INDEX IF NOT EXISTS story_evidence_cache_branch_name_idx ON public.story_evidence_cache(branch_name);
CREATE INDEX IF NOT EXISTS story_evidence_cache_commit_sha_idx ON public.story_evidence_cache(commit_sha);
CREATE INDEX IF NOT EXISTS story_evidence_cache_run_id_idx ON public.story_evidence_cache(run_id);

-- Add trigger to automatically update updated_at timestamp
CREATE TRIGGER set_timestamp_story_evidence_cache
BEFORE UPDATE ON public.story_evidence_cache
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Down Migration

-- Drop trigger
DROP TRIGGER IF EXISTS set_timestamp_story_evidence_cache ON public.story_evidence_cache;

-- Drop indexes
DROP INDEX IF EXISTS public.story_evidence_cache_run_id_idx;
DROP INDEX IF EXISTS public.story_evidence_cache_commit_sha_idx;
DROP INDEX IF EXISTS public.story_evidence_cache_branch_name_idx;
DROP INDEX IF EXISTS public.story_evidence_cache_story_id_idx;
DROP INDEX IF EXISTS public.story_evidence_cache_story_commit_unique_idx;

-- Drop table
DROP TABLE IF EXISTS public.story_evidence_cache;
