```js

{
  "story": "Given I'm a logged-in user, I can create a new AI thread that has no moderation controls. Messages sent are inserted without AI review, and once the thread is archived, I can no longer send messages.",
  "givens": [
    {
      "fact": "The user is authenticated and has an active session.",
      "evidence": [
        "src/auth/session.ts:12-28"
      ]
    },
    {
      "fact": "The interface provides a visible control to create a new thread.",
      "evidence": [
          "src/components/ThreadList/CreateThreadButton.tsx:3-19"
      ]
    },
    {
      "fact": "Creating a thread results in a persisted AI thread entity associated with the user.",
      "evidence": [
        "src/api/threads/create.ts:40-67"
      ]
    }
  ]
}

import { z } from "zod";

// 🌸 Step Evaluation Agent 🌸

// INPUT
export const Steps = z.object({
  story: z.string().describe("The full user story for context."),
  // givens = steps with the requirement->fact and evidence provided
  givens: z.array(z.object({
    fact: z.string().min(1).describe("A statement of what this fact is."),
    evidence: z.array(z.string().min(1).describe("A list of evidence items that support the fact in the format of <file_path>:<line_range>.")),
    status: z.enum(["verified", "not_verified", "uncertain"]).default("uncertain")
  })).describe("A list of givens that must be true before this step."),
  nextStep: StepSchema.describe("The next step to evaluate."),
});

// Example
const nextStepToWorkon = {
  story: "...",
  stepToEvaluate: "user can create new ai thread",
  "givens": [
    {
      "validatedFact": "User is logged in",
    },
    {
      "fact": "user can create new ai thread",
      "evidence": [
       "src/components/ThreadList/CreateThreadButton.tsx:3-19"
      ],
      "status": "verified"
    },
    {
      ...
    }
  ]
}

// OUTPUT
```

need your help with a system prompt and agent flow

we get user stories and run a decomposition step to extract steps that we save in the database to test during out ci. Here is breakdown of that flow

1. user writes a story
2. kyoto decomposition task runs
3. story + decomposition stored in database
4. ...wait for github push webhook...
5. webhook for push triggers ci
6. we start a vm in the cloud and clone repo
7. we retrieve the story + decomposition
8. we desire to evaluate the decomposition by seeking evidence in the code base if the step is possible or not provided evidence

# Decomposition Schema

```ts
const stepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('given'),
    given: z.string().min(1),
  }),
  z.object({
    type: z.literal('requirement'),
    outcome: z
      .string()
      .min(1)
      .describe('Eg., User can login using their email and password.'),
    assertions: z.array(
      z
        .string()
        .min(1)
        .describe(
          'Declarative, human-readable statements describing what becomes true in this step.',
        ),
    ),
  }),
])

export const decompositionOutputSchema = z.object({
  steps: z
    .array(stepSchema)
    .describe(
      'A sequential list of steps, each either a given precondition or a requirement with assertions.',
    ),
})
```

We will likely spawn an agent for each step for an isolated evaluation.
This way the agent has a more specific objective.
Each assertion will need evidence to verify it's true

# Desired Evaluation Agent

## Inital Input

Example step the agent will evaluate

```json
{
  "type": "requirement",
  "outcome": "User can create a new team.",
  "assertions": [
    "The user can create a new team.",
    "The new team is created and appears in the user's team list."
  ]
}
```

Remap of data before agent works

```json
{
"givens": [
    {
    "fact": "The user has logged in",
    "evidence": [
        "src/auth/session.ts:12-28"
    ]
    },
    ...
],
"verify": {
  "outcome": "User can create a new team.",
  "assertions": [
    "The user can create a new team.",
    "The new team is created and appears in the user's team list.",
  ]
}
}
```

Now the agent has to work on the object above resulting in

```json
{
  "conclusion": "pass | fail | uncertain",
  "outcome": "User can create a new team.",
  "assertions": [
    {
      "fact": "The user can create a new team.",
      "evidence": ["src/components/ThreadList/CreateThreadButton.tsx:3-19"]
    },
    {
      "fact": "The new team is created and appears in the user's team list.",
      "evidence": ["src/components/ThreadList/CreateThreadButton.tsx:3-19"]
    }
  ]
}
```

We are building the Evaluation Agent, please outline the high level steps back to me so we are on the same page.
