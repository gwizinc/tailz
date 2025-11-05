---
description: How to use tRPC and react-query in the app
globs: 
alwaysApply: false
---
The project integrates tRPC with `@tanstack/react-query` by consistently using helper methods provided by the tRPC client. This approach standardizes how queries and mutations are defined and how their respective React Query keys are generated.

Key characteristics of tRPC usage in this codebase:

1.  **Client Initialization**:
    *   The tRPC client is obtained within custom React hooks using `const trpc = useTRPC()`. This `useTRPC` hook is typically imported from a central client setup file (e.g., `@/client/trpc`).

2.  **Using `queryOptions` for Queries**:
    *   When setting up queries with `useQuery` from `@tanstack/react-query`, instead of manually defining query keys and fetcher functions, the code leverages a `queryOptions` helper method available on each tRPC query procedure.
    *   This method takes the query input as its first argument and an optional object for tRPC/React Query options (like `enabled`) as its second argument.
    *   Example:
        ```typescript
        // In use-conversation-messages.ts
        const messagesQuery = useQuery(
          trpc.message.list.queryOptions(
            conversationId ? { conversationId } : skipToken,
            { enabled: queryEnabled },
          ),
        );

        // In use-tenant.ts
        const { data: tenant } = useQuery(trpc.tenant.getTenant.queryOptions());
        ```

3.  **Using `mutationOptions` for Mutations**:
    *   Similarly, for mutations with `useMutation` from `@tanstack/react-query`, a `mutationOptions` helper method is used. This method is available on each tRPC mutation procedure.
    *   It can be called without arguments or with an object containing tRPC-specific options. The result is then spread into the `useMutation` hook's options, often alongside React Query mutation callbacks like `onMutate`, `onSuccess`, `onError`, and `onSettled`.
    *   Example:
        ```typescript
        // In use-chat-assets.ts
        const createPresignedUrlMutation = useMutation(
          trpc.asset.generatePresignedUrl.mutationOptions(),
        );

        // In use-conversation-delete.ts
        const mutation = useMutation({
          ...trpc.conversation.delete.mutationOptions(),
          onMutate: async (variables) => { /* ... */ },
          onSuccess: () => { /* ... */ },
          // ... other callbacks
        });
        ```

4.  **Generating Query Keys with `queryKey`**:
    *   For operations that require direct interaction with the React Query cache (e.g., invalidating queries, setting query data optimistically), a `queryKey` helper method is used. This method is available on tRPC query procedures and takes the query input as an argument.
    *   Example:
        ```typescript
        // In use-conversation-messages.ts
        queryClient.invalidateQueries({
          queryKey: trpc.conversation.list.queryKey({}),
        });

        queryClient.setQueryData(
          trpc.message.list.queryKey({ conversationId: message.conversationId }),
          // ... updater function
        );
        ```

5.  **Procedure Path**:
    *   tRPC procedures are accessed via a path on the initialized `trpc` client object, typically structured as `trpc.namespace.procedureName` (e.g., `trpc.message.list`, `trpc.asset.generatePresignedUrl`).

6.  **Integration with `useQueryClient`**:
    *   The `useQueryClient` hook from `@tanstack/react-query` is frequently used for cache manipulation tasks like invalidating data, performing optimistic updates, and cancelling outgoing requests, especially within mutation lifecycle callbacks.

This consistent use of `queryOptions`, `mutationOptions`, and `queryKey` helper methods streamlines the integration with `@tanstack/react-query`, ensuring that query keys are generated correctly and that options are passed in a standardized way. It abstracts away some of the manual setup that might be seen in other tRPC and React Query integrations.
