import type { ColumnType, RawBuilder } from 'kysely'

export type JSONValue =
  | null
  | string
  | number
  | boolean
  | {
      [value: string]: JSONValue
    }
  | Array<JSONValue>

export interface StoryTestCodeReference {
  filePath: string
  repoPath?: string | null
  summary?: string | null
  startLine?: number | null
  endLine?: number | null
}

export interface StoryTestFinding {
  title: string
  detail?: string | null
  references?: StoryTestCodeReference[]
}

export interface StoryTestIssue {
  title: string
  description?: string | null
  references?: StoryTestCodeReference[]
  missing?: string[]
}

export interface StoryTestLoopIteration {
  iteration: number
  action: string
  notes?: string | null
  references?: StoryTestCodeReference[]
  outputSummary?: string | null
}

export interface RunStory {
  storyId: string
  status: 'pass' | 'fail' | 'running' | 'skipped' | 'blocked'
  resultId?: string | null
  startedAt?: string | null
  completedAt?: string | null
  summary?: string | null
}

// Column type for runs.stories JSONB array
export type RunStoryColumnType = ColumnType<
  RunStory[],
  RunStory[] | RawBuilder<RunStory[]>,
  RunStory[] | RawBuilder<RunStory[]>
>

export interface StoryTestResultPayload {
  status: 'pass' | 'fail' | 'blocked' | 'running'
  summary?: string | null
  findings: StoryTestFinding[]
  issues: StoryTestIssue[]
  missingRequirements: string[]
  codeReferences: StoryTestCodeReference[]
  reasoning: JSONValue
  loopIterations: StoryTestLoopIteration[]
  rawOutput?: JSONValue
  metadata?: JSONValue
  startedAt: string
  completedAt?: string | null
  durationMs?: number | null
}

// Example of how to define a custom column type
//
// export type ProjectStage = {
//   name: string
//   description: string
// }

// // Includes RawBuilder to allow for JSONB
// export type ProjectStageColumnType = ColumnType<
//   ProjectStage[] | null,
//   ProjectStage[] | null | RawBuilder<ProjectStage[]>,
//   ProjectStage[] | null | RawBuilder<ProjectStage[]>
// >

// export type EmailAddress = {
//   email: string
//   name?: string
// }

// // Email address array type for JSONB columns
// export type EmailAddressColumnType = ColumnType<
//   EmailAddress[],
//   EmailAddress[] | RawBuilder<EmailAddress[]>,
//   EmailAddress[] | RawBuilder<EmailAddress[]>
// >
