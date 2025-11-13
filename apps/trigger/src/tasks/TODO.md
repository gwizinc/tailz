```js
Okay, now walk me through how it may look like from the perspective of the AI where we have the first step running and then it's given the assertions of the next step as givens proceed all the way through this exmaple story below

{
  "steps": [
    "The user is authenticated and has an active logged-in session.",
    "The user can access an interface control to create a new thread.",
    "The user creates a new AI thread using the thread-creation flow.",
    "The newly created thread appears in the user's thread list and/or opens in the thread view.",
    "The thread is presented as an AI thread (visually identifiable as an AI-created or AI-type thread).",
    "The thread view does not display any AI moderation controls, moderation toggle, or any UI indicating messages will be reviewed before insertion.",
    "The user can compose and send a message in the AI thread while it is active.",
    "When the user sends a message in the AI thread, the message appears in the thread immediately (no pending/review indicator is shown).",
    "Messages sent in the AI thread are visible in the thread without any intermediate moderation step or visible moderation status.",
    "The user archives the AI thread using the archive action available in the thread view or thread list.",
    "After archiving, the thread is shown in an archived state (archived badge, label, or moved to archived list) so its archived status is visible.",
    "While the thread is archived, the message composition or send function for that thread is disabled or blocked (the user cannot successfully send new messages).",
    "Attempts to send a new message in the archived thread do not add the message to the thread and provide a clear indication that sending is not allowed (disabled control, error, or informational message)."
  ]
}



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

// 🌸 Story Decomposition Agent 🌸
// Given: user provided a story

// INPUT
export const StorySchema = z.object({
  story: z.string().describe("The full user story for context."),
});

// OUTPUT
export const StepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("given"),
    given: z.string().min(1)
  }),
  z.object({
    type: z.literal("requirement"),
    outcome: z.string().min(1).describe("Eg., User can login using their email and password."),
    assertions: z.array(z.string().min(1).describe("Declarative statements describing what becomes true in this step."))
  })
]);

// EXAMPLE

const outputExample = {
  "steps": [
    {
      "given": "User is logged in",
    },
    {
      "outcome": "user can create new ai thread", // because it's a given already
      "assertions": [
       "The user can access an interface control to create a new thread.", // can view
       "The user can create a new AI thread using the thread-creation flow.", // can choose
       "thread appears in the user's thread list and/or opens in the thread view", // can see result
       "the thread is presented as an AI thread (visually identifiable as an AI-created or AI-type thread).",
      ]
    },
    {
      "outcome": "AI threads have no AI moderation controls",
      "assertions": [
        "The thread view does not display any AI moderation controls, moderation toggle, or any UI indicating messages will be reviewed before insertion.",
      ]
    }
  ]
}


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