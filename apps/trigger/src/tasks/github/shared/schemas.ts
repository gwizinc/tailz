import { z } from 'zod'

export const idSchema = z.union([z.number().int(), z.string(), z.bigint()])

const accountSchema = z
  .object({
    login: z.string(),
    id: idSchema.optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    avatar_url: z.string().optional(),
    html_url: z.string().optional(),
  })
  .passthrough()

const senderSchema = z
  .object({
    id: idSchema,
    login: z.string(),
    type: z.string().optional(),
    avatar_url: z.string().optional(),
  })
  .passthrough()

const repositorySchema = z.object({
  id: idSchema.optional(),
  name: z.string(),
  full_name: z.string().optional(),
  private: z.boolean().optional(),
  description: z.string().nullable().optional(),
  default_branch: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
  owner: accountSchema.optional(),
})

export const installationEventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: idSchema,
    account: accountSchema,
  }),
  repositories: z.array(repositorySchema).optional(),
  sender: senderSchema,
})

export const installationRepositoriesEventSchema = z.object({
  action: z.enum(['added', 'removed']),
  installation: z.object({
    id: idSchema,
  }),
  repositories_added: z.array(repositorySchema).optional(),
  repositories_removed: z.array(repositorySchema).optional(),
  sender: senderSchema,
})

const pushRepositoryOwnerSchema = z
  .object({
    login: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough()

const commitAuthorSchema = z
  .object({
    id: idSchema.optional(),
    login: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
  })
  .passthrough()

const commitSchema = z
  .object({
    id: z.string().optional(),
    message: z.string().optional(),
    author: commitAuthorSchema.optional(),
  })
  .passthrough()

export const pushEventSchema = z.object({
  ref: z.string(),
  after: z.string().optional(),
  repository: repositorySchema.extend({
    owner: pushRepositoryOwnerSchema.optional(),
  }),
  commits: z.array(commitSchema).optional(),
  head_commit: commitSchema.optional(),
})

const pullRequestUserSchema = z
  .object({
    login: z.string(),
  })
  .passthrough()

export const pullRequestEventSchema = z.object({
  action: z.string(),
  number: z.number().int(),
  repository: repositorySchema.extend({
    owner: pushRepositoryOwnerSchema.optional(),
  }),
  pull_request: z.object({
    number: z.number().int(),
    head: z.object({
      ref: z.string(),
      sha: z.string().optional(),
      repo: repositorySchema.extend({
        owner: pushRepositoryOwnerSchema.optional(),
      }),
    }),
    user: pullRequestUserSchema.optional(),
  }),
})

export const statusEventSchema = z.object({
  state: z.enum(['success', 'failure', 'error', 'pending']),
  context: z.string(),
  target_url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sha: z.string(),
  repository: repositorySchema,
})

export const installationTargetsEventSchema = z.object({
  action: z.enum(['renamed']),
  account: accountSchema,
  changes: z
    .object({
      login: z
        .object({
          from: z.string(),
        })
        .optional(),
    })
    .optional(),
  installation: z.object({
    id: idSchema,
  }),
  sender: senderSchema.optional(),
})

export type AccountPayload = z.infer<typeof accountSchema>
export type RepositoryPayload = z.infer<typeof repositorySchema>
