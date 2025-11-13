import path from 'node:path'

import { Daytona } from '@daytonaio/sdk'
import { parseEnv } from './env'

type DaytonaClient = InstanceType<typeof Daytona>
type DaytonaSandbox = Awaited<ReturnType<DaytonaClient['get']>>

export async function getDaytonaSandbox(
  // TODO if missing need to create one
  sandboxId: string,
): Promise<DaytonaSandbox> {
  const { DAYTONA_API_KEY: apiKey } = parseEnv()
  const daytona = new Daytona({ apiKey })
  return await daytona.get(sandboxId)
}

export function resolveWorkspacePath(inputPath: string): string | null {
  const workspaceRoot = `workspace/repo`
  const normalized = inputPath.replace(/\\/g, '/')

  if (normalized.startsWith(workspaceRoot)) {
    return normalized
  }

  const repoSegment = `/repo/`
  if (normalized.startsWith('/')) {
    const repoIndex = normalized.indexOf(repoSegment)
    if (repoIndex >= 0) {
      const relativeToRepo =
        normalized.slice(repoIndex + repoSegment.length) || '.'
      const resolved = path.posix.join(workspaceRoot, relativeToRepo)
      return resolved.startsWith(workspaceRoot) ? resolved : null
    }
    return null
  }

  const resolved = path.posix.join(workspaceRoot, normalized)
  return resolved.startsWith(workspaceRoot) ? resolved : null
}
