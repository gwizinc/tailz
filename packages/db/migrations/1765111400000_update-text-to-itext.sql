-- Up Migration

-- Enable citext extension for case-insensitive text
CREATE EXTENSION IF NOT EXISTS citext;

-- Step 1: Normalize existing data to lowercase to prevent constraint violations
-- This ensures all existing data is in a consistent case before converting to citext
UPDATE owners SET login = LOWER(login) WHERE login != LOWER(login);
UPDATE repos SET name = LOWER(name) WHERE name != LOWER(name);
UPDATE repos SET full_name = LOWER(full_name) WHERE full_name IS NOT NULL AND full_name != LOWER(full_name);

-- Step 2: Drop existing unique constraints
-- These will be recreated after converting to citext
ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_login_unique;
ALTER TABLE repos DROP CONSTRAINT IF EXISTS repos_owner_name_unique;

-- Step 3: Convert column types to citext
-- citext automatically handles case-insensitive comparisons
ALTER TABLE owners ALTER COLUMN login TYPE citext USING login::citext;
ALTER TABLE repos ALTER COLUMN name TYPE citext USING name::citext;
ALTER TABLE repos ALTER COLUMN full_name TYPE citext USING full_name::citext;

-- Step 4: Recreate unique constraints (now case-insensitive)
-- The constraints will enforce uniqueness regardless of case
ALTER TABLE owners ADD CONSTRAINT owners_login_unique UNIQUE (login);
ALTER TABLE repos ADD CONSTRAINT repos_owner_name_unique UNIQUE (owner_id, name);

-- Step 5: Create functions to normalize inserts/updates
-- This ensures data is always stored in lowercase for consistency
CREATE OR REPLACE FUNCTION normalize_owner_login()
RETURNS TRIGGER AS $$
BEGIN
  NEW.login = LOWER(NEW.login);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_repo_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name = LOWER(NEW.name);
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name = LOWER(NEW.full_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create triggers to automatically normalize data on insert/update
CREATE TRIGGER normalize_owner_login_trigger
BEFORE INSERT OR UPDATE ON owners
FOR EACH ROW EXECUTE FUNCTION normalize_owner_login();

CREATE TRIGGER normalize_repo_fields_trigger
BEFORE INSERT OR UPDATE ON repos
FOR EACH ROW EXECUTE FUNCTION normalize_repo_fields();

-- Down Migration

-- Drop triggers
DROP TRIGGER IF EXISTS normalize_repo_fields_trigger ON repos;
DROP TRIGGER IF EXISTS normalize_owner_login_trigger ON owners;

-- Drop functions
DROP FUNCTION IF EXISTS normalize_repo_fields();
DROP FUNCTION IF EXISTS normalize_owner_login();

-- Drop unique constraints
ALTER TABLE repos DROP CONSTRAINT IF EXISTS repos_owner_name_unique;
ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_login_unique;

-- Revert column types back to text
ALTER TABLE repos ALTER COLUMN full_name TYPE text USING full_name::text;
ALTER TABLE repos ALTER COLUMN name TYPE text USING name::text;
ALTER TABLE owners ALTER COLUMN login TYPE text USING login::text;

-- Recreate original constraints
ALTER TABLE owners ADD CONSTRAINT owners_login_unique UNIQUE (login);
ALTER TABLE repos ADD CONSTRAINT repos_owner_name_unique UNIQUE (owner_id, name);

-- Note: We don't drop the citext extension in the down migration
-- as it might be used by other parts of the database
-- If needed, manually run: DROP EXTENSION IF EXISTS citext;
