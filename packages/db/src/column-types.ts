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

export interface StoryAnalysisEvidenceReference {
  filePath: string
  startLine: number | null
  endLine: number | null
  note: string | null
}

export interface StoryAnalysisV1 {
  conclusion: 'pass' | 'fail' | 'blocked'
  explanation: string
  evidence: StoryAnalysisEvidenceReference[]
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
  analysisVersion: number
  analysis: StoryAnalysisV1 | null
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
