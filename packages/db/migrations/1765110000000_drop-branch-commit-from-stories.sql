-- Up Migration
DROP INDEX IF EXISTS public.stories_repo_branch_idx;
DROP INDEX IF EXISTS public.stories_branch_name_idx;

ALTER TABLE public.stories
  DROP COLUMN IF EXISTS branch_name,
  DROP COLUMN IF EXISTS commit_sha;

-- Down Migration
ALTER TABLE public.stories
  ADD COLUMN branch_name text,
  ADD COLUMN commit_sha text;

COMMENT ON COLUMN public.stories.branch_name IS 'The branch name this story was generated from (e.g., "main", "master")';
COMMENT ON COLUMN public.stories.commit_sha IS 'The SHA of the commit that was analyzed';

UPDATE public.stories
SET branch_name = 'main'
WHERE branch_name IS NULL;

ALTER TABLE public.stories
  ALTER COLUMN branch_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS stories_branch_name_idx ON public.stories(branch_name);
CREATE INDEX IF NOT EXISTS stories_repo_branch_idx ON public.stories(repo_id, branch_name);

