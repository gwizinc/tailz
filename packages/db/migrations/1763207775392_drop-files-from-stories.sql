-- Up Migration

-- Drop the files column from stories table
-- This column was never populated and always contained empty arrays
ALTER TABLE public.stories
DROP COLUMN IF EXISTS files;

-- Down Migration

-- Restore the files column (for rollback purposes)
ALTER TABLE public.stories
ADD COLUMN files jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.stories.files IS 'Array of file references in format ["path@startLine:endLine", ...]';
