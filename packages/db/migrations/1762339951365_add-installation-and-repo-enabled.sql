-- Up Migration

-- Add installation_id to owners to track GitHub App installation per owner/org
ALTER TABLE public.owners
ADD COLUMN IF NOT EXISTS installation_id BIGINT;

-- Ensure only one installation_id per owner (optional uniqueness if desired)
CREATE UNIQUE INDEX IF NOT EXISTS owners_installation_id_unique
ON public.owners (installation_id)
WHERE installation_id IS NOT NULL;

-- Add enabled flag to repos to mark which repos are active in our app
ALTER TABLE public.repos
ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false;

-- Down Migration

-- Remove enabled column from repos
ALTER TABLE public.repos
DROP COLUMN IF EXISTS enabled;

-- Drop unique index and installation_id from owners
DROP INDEX IF EXISTS owners_installation_id_unique;
ALTER TABLE public.owners
DROP COLUMN IF EXISTS installation_id;

