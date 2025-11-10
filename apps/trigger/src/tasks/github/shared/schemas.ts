import { z } from 'zod'

export const idSchema = z.union([z.number().int(), z.string(), z.bigint()])

export const accountSchema = z
  .object({
    login: z.string(),
    id: idSchema.optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    avatar_url: z.string().optional(),
    html_url: z.string().optional(),
  })
  .passthrough()

export const repositorySchema = z.object({
  id: idSchema.optional(),
  name: z.string(),
  full_name: z.string().optional(),
  private: z.boolean().optional(),
  description: z.string().nullable().optional(),
  default_branch: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
})

export const installationEventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: idSchema,
    account: accountSchema,
  }),
  repositories: z.array(repositorySchema).optional(),
})

export const installationRepositoriesEventSchema = z.object({
  action: z.enum(['added', 'removed']),
  installation: z.object({
    id: idSchema,
  }),
  repositories_added: z.array(repositorySchema).optional(),
  repositories_removed: z.array(repositorySchema).optional(),
})

export type AccountPayload = z.infer<typeof accountSchema>
export type RepositoryPayload = z.infer<typeof repositorySchema>

