--
-- PostgreSQL database dump
--

\restrict CNtU6swIBsleCxoLgC4q6fde6Mxdlpx51CChdZhSMMfSArfzDEgaaetxS5d3U6g

-- Dumped from database version 16.10 (Postgres.app)
-- Dumped by pg_dump version 16.10 (Postgres.app)


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'disabled',
    'invited'
);


--
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;




--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN accounts.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.id IS 'Unique identifier for each account';


--
-- Name: COLUMN accounts.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.user_id IS 'The id of the user';


--
-- Name: COLUMN accounts.account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.account_id IS 'The id of the account as provided by the SSO or equal to user_id for credential accounts';


--
-- Name: COLUMN accounts.provider_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.provider_id IS 'The id of the provider';


--
-- Name: COLUMN accounts.access_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.access_token IS 'The access token of the account. Returned by the provider';


--
-- Name: COLUMN accounts.refresh_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.refresh_token IS 'The refresh token of the account. Returned by the provider';


--
-- Name: COLUMN accounts.id_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.id_token IS 'The id token returned from the provider';


--
-- Name: COLUMN accounts.access_token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.access_token_expires_at IS 'The time when the access token expires';


--
-- Name: COLUMN accounts.refresh_token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.refresh_token_expires_at IS 'The time when the refresh token expires';


--
-- Name: COLUMN accounts.scope; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.scope IS 'The scope of the account. Returned by the provider';


--
-- Name: COLUMN accounts.password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.password IS 'The password of the account. Mainly used for email and password authentication';


--
-- Name: COLUMN accounts.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.created_at IS 'The time when the account was created';


--
-- Name: COLUMN accounts.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.updated_at IS 'The time when the account was last updated';


--
-- Name: credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_account_id text,
    email text,
    label text,
    tokens jsonb NOT NULL,
    "primary" boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN credentials.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.id IS 'Unique identifier for each credential';


--
-- Name: COLUMN credentials.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.user_id IS 'The id of the user who owns this credential';


--
-- Name: COLUMN credentials.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.provider IS 'The authentication provider name';


--
-- Name: COLUMN credentials.provider_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.provider_account_id IS 'The account id from the provider';


--
-- Name: COLUMN credentials.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.email IS 'The email associated with this credential';


--
-- Name: COLUMN credentials.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.label IS 'A user-friendly label for this credential';


--
-- Name: COLUMN credentials.tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.tokens IS 'JSON object containing provider tokens';


--
-- Name: COLUMN credentials."primary"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials."primary" IS 'Whether this is the primary credential for the user';


--
-- Name: COLUMN credentials.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.created_at IS 'The time when the credential was created';


--
-- Name: COLUMN credentials.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.updated_at IS 'The time when the credential was last updated';


--
-- Name: owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    external_id bigint,
    login text NOT NULL,
    name text,
    type text,
    avatar_url text,
    html_url text
);


--
-- Name: COLUMN owners.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.id IS 'Unique identifier for each owner';


--
-- Name: COLUMN owners.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.created_at IS 'Creation timestamp';


--
-- Name: COLUMN owners.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.updated_at IS 'Update timestamp (auto-managed by trigger)';


--
-- Name: COLUMN owners.external_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.external_id IS 'External provider id (e.g., GitHub id)';


--
-- Name: COLUMN owners.login; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.login IS 'Owner login/handle (e.g., GitHub login)';


--
-- Name: COLUMN owners.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.name IS 'Display name of the owner';


--
-- Name: COLUMN owners.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.type IS 'Owner type (e.g., user or organization)';


--
-- Name: COLUMN owners.avatar_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.avatar_url IS 'Avatar image URL';


--
-- Name: COLUMN owners.html_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.owners.html_url IS 'HTML profile URL';


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: repos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    external_id bigint,
    name text NOT NULL,
    full_name text,
    private boolean DEFAULT false NOT NULL,
    description text,
    default_branch text,
    html_url text
);


--
-- Name: COLUMN repos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.id IS 'Unique identifier for each repository';


--
-- Name: COLUMN repos.owner_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.owner_id IS 'FK to owners.id of the repository owner';


--
-- Name: COLUMN repos.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.created_at IS 'Creation timestamp';


--
-- Name: COLUMN repos.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.updated_at IS 'Update timestamp (auto-managed by trigger)';


--
-- Name: COLUMN repos.external_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.external_id IS 'External provider id (e.g., GitHub repo id)';


--
-- Name: COLUMN repos.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.name IS 'Short repository name';


--
-- Name: COLUMN repos.full_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.full_name IS 'Fully qualified name (e.g., owner/name)';


--
-- Name: COLUMN repos.private; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.private IS 'Whether the repository is private';


--
-- Name: COLUMN repos.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.description IS 'Repository description';


--
-- Name: COLUMN repos.default_branch; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.default_branch IS 'Default branch name';


--
-- Name: COLUMN repos.html_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repos.html_url IS 'HTML repository URL';


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN sessions.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.id IS 'Unique identifier for each session';


--
-- Name: COLUMN sessions.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.user_id IS 'The id of the user';


--
-- Name: COLUMN sessions.token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.token IS 'The unique session token';


--
-- Name: COLUMN sessions.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.expires_at IS 'The time when the session expires';


--
-- Name: COLUMN sessions.ip_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.ip_address IS 'The IP address of the device';


--
-- Name: COLUMN sessions.user_agent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.user_agent IS 'The user agent information of the device';


--
-- Name: COLUMN sessions.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.created_at IS 'The time when the session was created';


--
-- Name: COLUMN sessions.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.updated_at IS 'The time when the session was last updated';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    name text,
    email text,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    last_interaction_at timestamp with time zone,
    time_zone text
);


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id IS 'Unique identifier for each user';


--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.created_at IS 'The time when the user was created';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.updated_at IS 'The time when the user was last updated';


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.status IS 'The current status of the user account';


--
-- Name: COLUMN users.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.name IS 'The display name of the user';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.email IS 'The email address of the user';


--
-- Name: COLUMN users.email_verified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.email_verified IS 'Whether the user email is verified';


--
-- Name: COLUMN users.image; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.image IS 'The image URL of the user';


--
-- Name: COLUMN users.last_interaction_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.last_interaction_at IS 'The time when the user last interacted with the system';


--
-- Name: COLUMN users.time_zone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.time_zone IS 'The user preferred timezone';


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN verifications.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verifications.id IS 'Unique identifier for each verification';


--
-- Name: COLUMN verifications.identifier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verifications.identifier IS 'The identifier for the verification request';


--
-- Name: COLUMN verifications.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verifications.value IS 'The value to be verified';


--
-- Name: COLUMN verifications.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verifications.expires_at IS 'The time when the verification request expires';


--
-- Name: COLUMN verifications.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verifications.created_at IS 'The time when the verification was created';


--
-- Name: COLUMN verifications.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verifications.updated_at IS 'The time when the verification was last updated';


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (id);


--
-- Name: owners owners_external_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owners_external_id_unique UNIQUE (external_id);


--
-- Name: owners owners_login_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owners_login_unique UNIQUE (login);


--
-- Name: owners owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owners_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: repos repos_external_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repos
    ADD CONSTRAINT repos_external_id_unique UNIQUE (external_id);


--
-- Name: repos repos_owner_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repos
    ADD CONSTRAINT repos_owner_name_unique UNIQUE (owner_id, name);


--
-- Name: repos repos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repos
    ADD CONSTRAINT repos_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: accounts set_timestamp_accounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_accounts BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: owners set_timestamp_owners; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_owners BEFORE UPDATE ON public.owners FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: repos set_timestamp_repos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_repos BEFORE UPDATE ON public.repos FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: sessions set_timestamp_sessions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_sessions BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: users set_timestamp_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: verifications set_timestamp_verifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_verifications BEFORE UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: credentials update_credentials_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_credentials_timestamp BEFORE UPDATE ON public.credentials FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: credentials credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: repos repos_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repos
    ADD CONSTRAINT repos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict CNtU6swIBsleCxoLgC4q6fde6Mxdlpx51CChdZhSMMfSArfzDEgaaetxS5d3U6g

