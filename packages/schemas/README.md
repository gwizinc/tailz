# Story Evaluation Schemas

This package provides Zod schemas for the complete story evaluation data flow. All schemas are type-safe and well-documented, making it easy to understand how data moves through the system.

## Data Flow Overview

```
Raw Story → Decomposition → Test/Evaluation → Cache
```

### 1. Raw Story

**Input**: User-provided story text in Gherkin or natural language

```typescript
import { rawStoryInputSchema, type RawStoryInput } from '@app/schemas'

const story: RawStoryInput = {
  text: 'Feature: User Login\n  As a user...',
  title: 'User Login Story',
  files: ['src/auth/login.ts:1-50'],
}
```

### 2. Decomposition

**Input**: Raw story text  
**Output**: Structured steps (given preconditions + requirements with assertions)

```typescript
import {
  decompositionOutputSchema,
  type DecompositionOutput,
} from '@app/schemas'

const decomposition: DecompositionOutput = {
  steps: [
    {
      type: 'given',
      given: 'The user is logged in',
    },
    {
      type: 'requirement',
      goal: 'User can create a new team',
      assertions: [
        'The user can create a new team',
        "The new team appears in the user's team list",
      ],
    },
  ],
}
```

### 3. Test/Evaluation

**Input**: Raw story + Decomposition  
**Output**: Evaluation results with evidence for each step

```typescript
import { evaluationOutputSchema, type EvaluationOutput } from '@app/schemas'

const evaluation: EvaluationOutput = {
  version: 3,
  status: 'pass',
  explanation: 'All steps were successfully verified...',
  steps: [
    {
      type: 'requirement',
      conclusion: 'pass',
      outcome: 'User can create a new team',
      assertions: [
        {
          fact: 'The user can create a new team',
          evidence: ['src/teams/create.ts:45-67'],
        },
      ],
    },
  ],
}
```

### 4. Cache

**Input**: Evaluation results (passing assertions only)  
**Output**: File hashes organized by step and assertion

```typescript
import { cacheDataSchema, type CacheData } from '@app/schemas'

const cacheData: CacheData = {
  steps: {
    '0': {
      assertions: {
        '0': {
          'src/auth/session.ts': 'sha256:abc123...',
          'src/auth/middleware.ts': 'sha256:def456...',
        },
      },
    },
  },
}
```

## Usage Examples

### Validating Raw Story Input

```typescript
import { rawStoryInputSchema } from '@app/schemas'

try {
  const validated = rawStoryInputSchema.parse(userInput)
  // Use validated story
} catch (error) {
  // Handle validation error
}
```

### Validating Decomposition Output

```typescript
import { decompositionOutputSchema } from '@app/schemas'

const result = await decompositionAgent.run(story)
const validated = decompositionOutputSchema.parse(result)
```

### Validating Evaluation Output

```typescript
import { evaluationOutputSchema } from '@app/schemas'

const result = await evaluationAgent.run({ story, decomposition })
const validated = evaluationOutputSchema.parse(result)
```

### Working with Cache

```typescript
import { cacheDataSchema, cacheEntrySchema } from '@app/schemas'

// Validate cache data structure
const cacheData = cacheDataSchema.parse(rawCacheData)

// Validate complete cache entry
const entry = cacheEntrySchema.parse(rawEntry)
```

## Type Safety

All schemas provide full TypeScript type inference:

```typescript
import type {
  RawStoryInput,
  DecompositionOutput,
  EvaluationOutput,
  CacheData,
} from '@app/schemas'

// Types are automatically inferred from schemas
function processStory(story: RawStoryInput): DecompositionOutput {
  // Type-safe operations
}
```

## Schema Reference

### Raw Story Schemas

- `rawStoryInputSchema` - User input validation
- `rawStorySchema` - Database storage format

### Decomposition Schemas

- `decompositionStepSchema` - Single step (given or requirement)
- `decompositionOutputSchema` - Complete decomposition result
- `decompositionInputSchema` - Input to decomposition agent

### Evaluation Schemas

- `testStatusSchema` - Test status enum
- `assertionEvidenceSchema` - Evidence for a single assertion
- `stepEvaluationSchema` - Evaluation result for a single step
- `evaluationOutputSchema` - Complete evaluation result
- `evaluationInputSchema` - Input to evaluation agent

### Cache Schemas

- `cacheDataSchema` - Cache data structure
- `cacheEntrySchema` - Complete cache entry
- `cacheValidationResultSchema` - Cache validation result

## Data Flow Documentation

For complete documentation of the data flow, transformations, and examples, see [`src/story-flow.ts`](./src/story-flow.ts). This file contains:

- Detailed schema definitions
- Transformation documentation
- Example data structures
- Flow diagrams in comments

## Type Exports

All types are exported directly from the main package:

- `testStatusSchema` - Test status enum schema
- `TestStatus` - Test status type
- `evaluationOutputSchema` - Evaluation output schema
- `EvaluationOutput` - Evaluation output type
- `decompositionOutputSchema` - Decomposition output schema
- `DecompositionOutput` - Decomposition output type

See the main exports in `src/index.ts` for the complete list.
