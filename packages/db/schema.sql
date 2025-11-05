--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Homebrew)
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: alexmaccaw
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'disabled',
    'invited'
);


ALTER TYPE public.user_status OWNER TO alexmaccaw;

--
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: alexmaccaw
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_timestamp() OWNER TO alexmaccaw;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: alexmaccaw
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.accounts OWNER TO alexmaccaw;

--
-- Name: COLUMN accounts.id; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.id IS 'Unique identifier for each account';


--
-- Name: COLUMN accounts.user_id; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.user_id IS 'The id of the user';


--
-- Name: COLUMN accounts.account_id; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.account_id IS 'The id of the account as provided by the SSO or equal to user_id for credential accounts';


--
-- Name: COLUMN accounts.provider_id; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.provider_id IS 'The id of the provider';


--
-- Name: COLUMN accounts.access_token; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.access_token IS 'The access token of the account. Returned by the provider';


--
-- Name: COLUMN accounts.refresh_token; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.refresh_token IS 'The refresh token of the account. Returned by the provider';


--
-- Name: COLUMN accounts.id_token; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.id_token IS 'The id token returned from the provider';


--
-- Name: COLUMN accounts.access_token_expires_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.access_token_expires_at IS 'The time when the access token expires';


--
-- Name: COLUMN accounts.refresh_token_expires_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.refresh_token_expires_at IS 'The time when the refresh token expires';


--
-- Name: COLUMN accounts.scope; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.scope IS 'The scope of the account. Returned by the provider';


--
-- Name: COLUMN accounts.password; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.password IS 'The password of the account. Mainly used for email and password authentication';


--
-- Name: COLUMN accounts.created_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.created_at IS 'The time when the account was created';


--
-- Name: COLUMN accounts.updated_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.accounts.updated_at IS 'The time when the account was last updated';


--
-- Name: credentials; Type: TABLE; Schema: public; Owner: alexmaccaw
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


ALTER TABLE public.credentials OWNER TO alexmaccaw;

--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: alexmaccaw
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO alexmaccaw;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: alexmaccaw
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pgmigrations_id_seq OWNER TO alexmaccaw;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: alexmaccaw
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: alexmaccaw
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO alexmaccaw;

--
-- Name: COLUMN sessions.id; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.id IS 'Unique identifier for each session';


--
-- Name: COLUMN sessions.user_id; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.user_id IS 'The id of the user';


--
-- Name: COLUMN sessions.token; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.token IS 'The unique session token';


--
-- Name: COLUMN sessions.expires_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.expires_at IS 'The time when the session expires';


--
-- Name: COLUMN sessions.ip_address; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.ip_address IS 'The IP address of the device';


--
-- Name: COLUMN sessions.user_agent; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.user_agent IS 'The user agent information of the device';


--
-- Name: COLUMN sessions.created_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.created_at IS 'The time when the session was created';


--
-- Name: COLUMN sessions.updated_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.sessions.updated_at IS 'The time when the session was last updated';


--
-- Name: users; Type: TABLE; Schema: public; Owner: alexmaccaw
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    name text,
    email text,
    last_interaction_at timestamp with time zone,
    time_zone text,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO alexmaccaw;

--
-- Name: COLUMN users.email_verified; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.users.email_verified IS 'Whether the user email is verified';


--
-- Name: COLUMN users.image; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.users.image IS 'The image URL of the user';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.users.updated_at IS 'The time when the user was last updated';


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: alexmaccaw
--

CREATE TABLE public.verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.verifications OWNER TO alexmaccaw;

--
-- Name: COLUMN verifications.id; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.verifications.id IS 'Unique identifier for each verification';


--
-- Name: COLUMN verifications.identifier; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.verifications.identifier IS 'The identifier for the verification request';


--
-- Name: COLUMN verifications.value; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.verifications.value IS 'The value to be verified';


--
-- Name: COLUMN verifications.expires_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.verifications.expires_at IS 'The time when the verification request expires';


--
-- Name: COLUMN verifications.created_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.verifications.created_at IS 'The time when the verification was created';


--
-- Name: COLUMN verifications.updated_at; Type: COMMENT; Schema: public; Owner: alexmaccaw
--

COMMENT ON COLUMN public.verifications.updated_at IS 'The time when the verification was last updated';


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: accounts set_timestamp_accounts; Type: TRIGGER; Schema: public; Owner: alexmaccaw
--

CREATE TRIGGER set_timestamp_accounts BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: sessions set_timestamp_sessions; Type: TRIGGER; Schema: public; Owner: alexmaccaw
--

CREATE TRIGGER set_timestamp_sessions BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: users set_timestamp_users; Type: TRIGGER; Schema: public; Owner: alexmaccaw
--

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: verifications set_timestamp_verifications; Type: TRIGGER; Schema: public; Owner: alexmaccaw
--

CREATE TRIGGER set_timestamp_verifications BEFORE UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: credentials update_credentials_timestamp; Type: TRIGGER; Schema: public; Owner: alexmaccaw
--

CREATE TRIGGER update_credentials_timestamp BEFORE UPDATE ON public.credentials FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: credentials credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alexmaccaw
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

