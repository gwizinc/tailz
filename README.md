# Monorepo Scaffold

This is a scaffold for a modern web application using a monorepo architecture. It's designed to provide a solid foundation for new projects, with a focus on type-safety, developer experience, and scalability.

## What's inside?

This monorepo includes:

- `apps/web`: An [Astro](https://astro.build/) application for the frontend.
- `packages/api`: A [tRPC](https://trpc.io/) API for type-safe client-server communication.
- `packages/db`: Database schemas, migrations, and query utilities using [Kysely](https://kysely.dev/).
- `packages/utils`: Shared utilities used across the monorepo.
- **Authentication**: Example implementation using [better-auth](https://github.com/better-auth/better-auth) with GitHub as an OAuth provider.
- **UI**: Basic UI setup with [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/).
- **Tooling**:
  - [Turborepo](https://turbo.build/repo) for high-performance builds.
  - [PNPM](https://pnpm.io/) for efficient package management.
  - [TypeScript](https://www.typescriptlang.org/) for static typing.
  - [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) for code quality.

## Perfect for AI-Assisted Development

This scaffold is specifically designed to excel with AI coding assistants and "vibe coding" workflows:

- **Rich Examples**: The codebase provides comprehensive examples of common patterns like API routing, database connections, migrations, authentication flows, and UI components that AI can learn from and replicate.
- **Comprehensive Cursor Rules**: Pre-configured `.cursor/rules/` directory with detailed guidelines for:
  - Database patterns and Kysely type helpers
  - tRPC and React Query integration patterns
  - React component conventions and shadcn/ui usage
  - TypeScript best practices and naming conventions
  - Environment variable management
  - Code organization and project structure
- **Consistent Patterns**: Standardized approaches across the entire stack make it easy for AI to understand and extend the codebase following established conventions.
- **Type Safety**: Full TypeScript coverage provides clear contracts and types that AI can work with confidently. We prefer types the function instead of an interface.

Whether you're pair programming with Claude, GitHub Copilot, or Cursor's AI, this scaffold gives your AI assistant the context and examples it needs to generate high-quality, consistent code that follows your project's patterns.

## Getting Started

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/gwizinc/tailz.git
    cd tailz
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**

    Create a `.env` file in `apps/web` and add the following variables:

    ```env
    # Generate a secret with `openssl rand -base64 32`
    AUTH_SECRET="your_auth_secret"

    # From your GitHub OAuth application
    GITHUB_CLIENT_ID="your_github_client_id"
    GITHUB_CLIENT_SECRET="your_github_client_secret"

    # From your GitHub App (for repository access)
    GITHUB_APP_ID="your_github_app_id"
    GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
    GITHUB_APP_SLUG="your_github_app_slug"

    # Your local PostgreSQL connection string
    DATABASE_URL="postgres://user:password@localhost:5432/tailz"

    # OpenAI-compatible API key (for AI features)
    OPENROUTER_API_KEY="your_openrouter_api_key"

    # Trigger.dev secret key (for background jobs)
    TRIGGER_SECRET_KEY="your_trigger_secret_key"
    ```

4.  **Set up the database:**

    Make sure you have a PostgreSQL server running. Then, run the migrations:

    ```bash
    DATABASE_URL="postgres://user:password@localhost:5432/tailz" pnpm --filter @app/db db:migrate
    ```

5.  **Run the development server:**

    ```bash
    pnpm dev
    ```

    The web application will be available at `http://localhost:3001`.

## Development

- `pnpm build`: Build all apps and packages.
- `pnpm lint`: Lint all code.
- `pnpm typecheck`: Run TypeScript to check for type errors.
- `pnpm test`: Run tests.

# Authors

- [@ocavue](https://github.com/ocavue)
- [@maccman](https://github.com/maccman)

# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
