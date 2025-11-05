-- Up Migration

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Types
CREATE TYPE user_status AS ENUM ('active', 'disabled', 'invited');

-- Functions
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users table with all columns defined at creation
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    status user_status NOT NULL DEFAULT 'active',
    name text,
    email text UNIQUE,
    email_verified boolean NOT NULL DEFAULT false,
    image text,
    last_interaction_at timestamptz,
    time_zone text
);

-- Users table comments
COMMENT ON COLUMN users.id IS 'Unique identifier for each user';
COMMENT ON COLUMN users.created_at IS 'The time when the user was created';
COMMENT ON COLUMN users.updated_at IS 'The time when the user was last updated';
COMMENT ON COLUMN users.status IS 'The current status of the user account';
COMMENT ON COLUMN users.name IS 'The display name of the user';
COMMENT ON COLUMN users.email IS 'The email address of the user';
COMMENT ON COLUMN users.email_verified IS 'Whether the user email is verified';
COMMENT ON COLUMN users.image IS 'The image URL of the user';
COMMENT ON COLUMN users.last_interaction_at IS 'The time when the user last interacted with the system';
COMMENT ON COLUMN users.time_zone IS 'The user preferred timezone';

-- Users table trigger
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Credentials table
CREATE TABLE credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_account_id text,
    email text,
    label text,
    tokens jsonb NOT NULL,
    "primary" boolean,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Credentials table comments
COMMENT ON COLUMN credentials.id IS 'Unique identifier for each credential';
COMMENT ON COLUMN credentials.user_id IS 'The id of the user who owns this credential';
COMMENT ON COLUMN credentials.provider IS 'The authentication provider name';
COMMENT ON COLUMN credentials.provider_account_id IS 'The account id from the provider';
COMMENT ON COLUMN credentials.email IS 'The email associated with this credential';
COMMENT ON COLUMN credentials.label IS 'A user-friendly label for this credential';
COMMENT ON COLUMN credentials.tokens IS 'JSON object containing provider tokens';
COMMENT ON COLUMN credentials."primary" IS 'Whether this is the primary credential for the user';
COMMENT ON COLUMN credentials.created_at IS 'The time when the credential was created';
COMMENT ON COLUMN credentials.updated_at IS 'The time when the credential was last updated';

-- Credentials table trigger
CREATE TRIGGER update_credentials_timestamp
BEFORE UPDATE ON credentials
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Sessions table
CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Sessions table comments
COMMENT ON COLUMN sessions.id IS 'Unique identifier for each session';
COMMENT ON COLUMN sessions.user_id IS 'The id of the user';
COMMENT ON COLUMN sessions.token IS 'The unique session token';
COMMENT ON COLUMN sessions.expires_at IS 'The time when the session expires';
COMMENT ON COLUMN sessions.ip_address IS 'The IP address of the device';
COMMENT ON COLUMN sessions.user_agent IS 'The user agent information of the device';
COMMENT ON COLUMN sessions.created_at IS 'The time when the session was created';
COMMENT ON COLUMN sessions.updated_at IS 'The time when the session was last updated';

-- Sessions table trigger
CREATE TRIGGER set_timestamp_sessions
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Accounts table
CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scope text,
    password text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Accounts table comments
COMMENT ON COLUMN accounts.id IS 'Unique identifier for each account';
COMMENT ON COLUMN accounts.user_id IS 'The id of the user';
COMMENT ON COLUMN accounts.account_id IS 'The id of the account as provided by the SSO or equal to user_id for credential accounts';
COMMENT ON COLUMN accounts.provider_id IS 'The id of the provider';
COMMENT ON COLUMN accounts.access_token IS 'The access token of the account. Returned by the provider';
COMMENT ON COLUMN accounts.refresh_token IS 'The refresh token of the account. Returned by the provider';
COMMENT ON COLUMN accounts.id_token IS 'The id token returned from the provider';
COMMENT ON COLUMN accounts.access_token_expires_at IS 'The time when the access token expires';
COMMENT ON COLUMN accounts.refresh_token_expires_at IS 'The time when the refresh token expires';
COMMENT ON COLUMN accounts.scope IS 'The scope of the account. Returned by the provider';
COMMENT ON COLUMN accounts.password IS 'The password of the account. Mainly used for email and password authentication';
COMMENT ON COLUMN accounts.created_at IS 'The time when the account was created';
COMMENT ON COLUMN accounts.updated_at IS 'The time when the account was last updated';

-- Accounts table trigger
CREATE TRIGGER set_timestamp_accounts
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Verifications table
CREATE TABLE verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Verifications table comments
COMMENT ON COLUMN verifications.id IS 'Unique identifier for each verification';
COMMENT ON COLUMN verifications.identifier IS 'The identifier for the verification request';
COMMENT ON COLUMN verifications.value IS 'The value to be verified';
COMMENT ON COLUMN verifications.expires_at IS 'The time when the verification request expires';
COMMENT ON COLUMN verifications.created_at IS 'The time when the verification was created';
COMMENT ON COLUMN verifications.updated_at IS 'The time when the verification was last updated';

-- Verifications table trigger
CREATE TRIGGER set_timestamp_verifications
BEFORE UPDATE ON verifications
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Down Migration
DROP TABLE IF EXISTS verifications;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS credentials;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS user_status;
DROP FUNCTION IF EXISTS trigger_set_timestamp();
