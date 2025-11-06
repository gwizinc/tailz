import OpenAI from 'openai'
import { z } from 'zod'

import type { CodebaseFile } from './fetch-codebase'

type GeneratedStory = {
  name: string
  story: string
  files: string[]
}

const storyResponseSchema = z.object({
  stories: z.array(
    z.object({
      name: z.string(),
      story: z.string(),
      files: z.array(z.string()),
    }),
  ),
})

interface GenerateStoriesParams {
  codebase: CodebaseFile[]
  apiKey: string
}

/**
 * Attempts to fix common JSON issues like unescaped control characters
 * This is a fallback for when JSON.parse() fails due to malformed JSON
 *
 * This function attempts to escape control characters that appear inside
 * JSON string values (between double quotes).
 */
function tryFixJsonString(jsonString: string): string {
  let result = ''
  let inString = false
  let escapeNext = false

  for (const char of jsonString) {
    if (escapeNext) {
      // We're already escaping this character, just copy it
      result += char
      escapeNext = false
      continue
    }

    if (char === '\\') {
      // Start of an escape sequence
      result += char
      escapeNext = true
      continue
    }

    if (char === '"') {
      // Toggle string state (only if not escaped)
      inString = !inString
      result += char
      continue
    }

    if (inString) {
      // We're inside a string value, escape control characters
      if (char === '\n') {
        result += String.raw`\n`
      } else if (char === '\r') {
        result += String.raw`\r`
      } else if (char === '\t') {
        result += String.raw`\t`
      } else if (char === '\f') {
        result += String.raw`\f`
      } else if (char === '\b') {
        result += String.raw`\b`
      } else {
        result += char
      }
    } else {
      // Outside string, copy as-is
      result += char
    }
  }

  return result
}

/**
 * Uses OpenRouter.ai to generate Gherkin-style stories from the codebase
 */
export async function generateStories(
  params: GenerateStoriesParams,
): Promise<GeneratedStory[]> {
  const { codebase, apiKey } = params

  // Format codebase for context
  const codebaseContext = codebase
    .map((file) => {
      const lines = file.content.split('\n')
      const lineCount = lines.length
      return `File: ${file.path} (${lineCount} lines)\n\`\`\`\n${file.content}\n\`\`\``
    })
    .join('\n\n---\n\n')

  // Create OpenAI client configured for OpenRouter
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/gwizinc/tailz', // Optional: identify your app
      'X-Title': 'Tailz Repository Analysis', // Optional: identify your app
    },
  })

  const prompt = `You are analyzing a codebase to identify core user functionality. Generate Gherkin-style stories that describe the main user-facing features and workflows.

For each story, provide:
1. A descriptive name/title
2. A complete Gherkin story with Feature, Scenario(s), Given/When/Then steps
3. An array of file references in the format "path@startLine:endLine" that relate to this story

Focus on:
- User-facing features and workflows
- Core business logic and functionality
- Integration points and APIs
- Authentication and authorization flows
- Data management operations

Format your response as JSON with this structure:
{
  "stories": [
    {
      "name": "Story title",
      "story": "Feature: ...\n  Scenario: ...\n    Given ...\n    When ...\n    Then ...",
      "files": ["path/to/file.ts@10:50", "another/file.tsx@5:30"]
    }
  ]
}

Codebase:
${codebaseContext}`

  let completion:
    | Awaited<ReturnType<typeof client.chat.completions.create>>
    | undefined
  let responseContent: string | undefined
  let cleanedContent: string | undefined

  try {
    completion = await client.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet', // Using a good model for code analysis
      messages: [
        {
          role: 'system',
          content:
            'You are a software analyst that identifies user functionality in codebases and writes Gherkin-style stories. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent, structured output
      response_format: { type: 'json_object' }, // Request JSON response
    })

    responseContent = completion.choices[0]?.message?.content ?? undefined
    if (!responseContent) {
      console.error('No response content from OpenRouter API:', {
        completion: JSON.stringify(completion, null, 2),
        choices: completion.choices,
        choicesLength: completion.choices.length,
      })
      throw new Error('No response content from OpenRouter API')
    }

    // Clean up the response before parsing
    // Remove markdown code blocks if present
    cleanedContent = responseContent.trim()
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '')
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent
        .replace(/^```\n?/, '')
        .replace(/\n?```$/, '')
    }
    cleanedContent = cleanedContent.trim()

    // Parse JSON response
    let parsedResponse: unknown
    try {
      parsedResponse = JSON.parse(cleanedContent)
    } catch (parseError) {
      // If parsing fails, try to fix common issues and retry
      const errorMessage =
        parseError instanceof Error ? parseError.message : 'Unknown error'

      // Log everything for debugging
      console.error('Initial JSON parse failed:', {
        error: errorMessage,
        originalResponse: responseContent,
        cleanedContent: cleanedContent,
        originalLength: responseContent.length,
        cleanedLength: cleanedContent.length,
      })

      // Try to fix and parse again
      try {
        const fixedContent = tryFixJsonString(cleanedContent)
        parsedResponse = JSON.parse(fixedContent)
        console.log('Successfully parsed JSON after applying fixes')
      } catch (retryError) {
        // If retry also fails, log everything including the fixed content
        const retryErrorMessage =
          retryError instanceof Error ? retryError.message : 'Unknown error'
        const fixedContent = tryFixJsonString(cleanedContent)
        console.error('Retry parse also failed:', {
          originalError: errorMessage,
          retryError: retryErrorMessage,
          originalResponse: responseContent,
          cleanedContent: cleanedContent,
          fixedContent: fixedContent,
          originalLength: responseContent.length,
          cleanedLength: cleanedContent.length,
          fixedLength: fixedContent.length,
        })
        throw new Error(
          `Failed to parse JSON response: ${errorMessage}. Retry also failed: ${retryErrorMessage}`,
        )
      }
    }

    // Validate with Zod schema
    let validated
    try {
      validated = storyResponseSchema.parse(parsedResponse)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error('Zod validation failed:', {
          validationErrors: validationError.errors,
          parsedResponse: parsedResponse,
          originalResponse: responseContent,
          cleanedContent: cleanedContent,
        })
        throw new Error(
          `Invalid response format from OpenRouter API: ${validationError.errors.map((e) => e.message).join(', ')}`,
        )
      }
      throw validationError
    }

    return validated.stories
  } catch (error) {
    // Log any other unexpected errors with full context
    if (!(error instanceof z.ZodError)) {
      console.error('Unexpected error in generateStories:', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        completion: completion
          ? JSON.stringify(completion, null, 2)
          : 'Completion not available (error occurred before API call completed)',
        responseContent: responseContent ?? 'Response content not available',
        cleanedContent: cleanedContent ?? 'Cleaned content not available',
      })
    }
    throw error
  }
}
