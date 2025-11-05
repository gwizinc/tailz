import { task, logger } from '@trigger.dev/sdk'
import { setupDb } from '@app/db'
import { createInstallationOctokit } from '../helpers/github'
import type { CodebaseFile } from '../helpers/fetch-codebase'
import { discoverStories } from '../helpers/discover-stories'

export const findStoriesInRepoTask = task({
  id: 'find-stories-in-repo',
  run: async (
    payload: {
      repoId: string
      appId: number
      privateKey: string
      openRouterApiKey: string
      databaseUrl: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Finding stories in repository', { repoId: payload.repoId })

    const db = setupDb(payload.databaseUrl)

    const repo = await db
      .selectFrom('repos')
      .innerJoin('owners', 'repos.ownerId', 'owners.id')
      .select([
        'repos.id',
        'repos.name as repoName',
        'repos.defaultBranch',
        'owners.login as ownerLogin',
        'owners.installationId',
      ])
      .where('repos.id', '=', payload.repoId)
      .executeTakeFirst()

    if (!repo || !repo.defaultBranch || !repo.installationId) {
      throw new Error('Repository or installation not found or misconfigured')
    }

    const octokit = createInstallationOctokit({
      appId: payload.appId,
      privateKey: payload.privateKey,
      installationId: Number(repo.installationId),
    })

    const branchRef = await octokit.git.getRef({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      ref: `heads/${repo.defaultBranch}`,
    })

    const commitSha = branchRef.data.object.sha

    const commit = await octokit.git.getCommit({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      commit_sha: commitSha,
    })

    const treeSha = commit.data.tree.sha

    const tree = await octokit.git.getTree({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      tree_sha: treeSha,
      recursive: '1',
    })

    const codeFileExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.rb',
      '.php',
      '.swift',
      '.kt',
      '.scala',
      '.cs',
      '.cpp',
      '.c',
      '.h',
      '.hpp',
      '.vue',
      '.svelte',
      '.astro',
      '.md',
      '.json',
      '.yaml',
      '.yml',
      '.toml',
      '.xml',
      '.sql',
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.dockerfile',
      '.makefile',
      '.cmake',
      '.gradle',
      '.m',
      '.mm',
      '.hpp',
      '.cc',
      '.cxx',
    ]

    const excludedPaths = [
      'node_modules',
      '.git',
      '.next',
      '.nuxt',
      '.cache',
      'dist',
      'build',
      'out',
      'coverage',
      '.nyc_output',
      '.vscode',
      '.idea',
      '.DS_Store',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.env',
      '.env.local',
      '.env.production',
      '.env.development',
      'vendor',
      '__pycache__',
      '.pytest_cache',
      '.mypy_cache',
      'target',
      '.gradle',
      '.class',
      '.jar',
      '.war',
      '.ear',
    ]

    const files: CodebaseFile[] = []

    for (const item of tree.data.tree) {
      if (item.type !== 'blob') {
        continue
      }

      const path = item.path ?? ''
      if (!path) {
        continue
      }

      const pathParts = path.split('/')
      if (pathParts.length > 2) {
        continue
      }

      const shouldExclude = excludedPaths.some((excluded) =>
        path.includes(excluded),
      )
      if (shouldExclude) {
        continue
      }

      const hasCodeExtension = codeFileExtensions.some((ext) =>
        path.toLowerCase().endsWith(ext),
      )
      const isRootConfigFile =
        path.split('/').length === 1 &&
        [
          'package.json',
          'tsconfig.json',
          'pyproject.toml',
          'Cargo.toml',
        ].includes(path)

      if (!hasCodeExtension && !isRootConfigFile) {
        continue
      }

      try {
        const contentResponse = await octokit.repos.getContent({
          owner: repo.ownerLogin,
          repo: repo.repoName,
          path,
          ref: repo.defaultBranch,
        })

        if (
          !Array.isArray(contentResponse.data) &&
          'content' in contentResponse.data &&
          contentResponse.data.encoding === 'base64'
        ) {
          const content = Buffer.from(
            contentResponse.data.content,
            'base64',
          ).toString('utf-8')
          files.push({ path, content })
        }
      } catch (error) {
        console.warn(`Failed to fetch file ${path}:`, error)
        continue
      }
    }

    const codebase = files

    const result = await discoverStories({
      codebase,
      apiKey: payload.openRouterApiKey,
    })

    if (!result.success) {
      logger.error('Failed to find stories in repo', {
        repoId: payload.repoId,
        error: result.error,
      })
      throw new Error(result.error || 'Failed to find stories in repo')
    }

    logger.info('Stories found in repo', {
      repoId: payload.repoId,
      storyCount: result.storyCount,
    })

    return {
      success: true,
      storyCount: result.storyCount,
      stories: result.stories,
    }
  },
})
