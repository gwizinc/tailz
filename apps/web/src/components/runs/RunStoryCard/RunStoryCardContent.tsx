import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import {
  getConclusionStyles,
  getDisplayStatus,
  getEvidenceConclusionDisplay,
  getLoadingConclusionDisplay,
} from '../utils'
import type { RunStory, StoryTestResult } from '../types'
import { z } from 'zod'

interface RunStoryCardContentProps {
  story: RunStory
  testResult: StoryTestResult | null
  orgName: string
  repoName: string
  commitSha: string | null
}

/**
 * Parses an evidence string in the format "path/to/file.tsx:128-133"
 * and converts it to a GitHub blob URL
 */
function parseEvidenceToGitHubLink(
  evidence: string,
  orgName: string,
  repoName: string,
  commitSha: string | null,
): { text: string; url: string | null } {
  // Match pattern: filepath:startLine-endLine
  const match = evidence.match(/^(.+):(\d+)-(\d+)$/)
  
  if (!match) {
    return { text: evidence, url: null }
  }

  const [, filePath, startLine, endLine] = match

  if (!commitSha) {
    return { text: evidence, url: null }
  }

  const url = `https://github.com/${orgName}/${repoName}/blob/${commitSha}/${filePath}#L${startLine}-L${endLine}`
  
  return { text: evidence, url }
}

export function RunStoryCardContent({
  story,
  testResult,
  orgName,
  repoName,
  commitSha,
}: RunStoryCardContentProps) {
  const storyResult = testResult
  const analysis = storyResult?.analysis ?? null
  const displayStatus = getDisplayStatus(story)
  const isRunning = displayStatus === 'running'

  // Parse decomposition data
  const decompositionSchema = z.object({
    steps: z.array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('given'),
          given: z.string().min(1),
        }),
        z.object({
          type: z.literal('requirement'),
          goal: z.string().min(1),
          assertions: z.array(z.string().min(1)),
        }),
      ]),
    ),
  })

  const parseDecomposition = (decomposition: unknown) => {
    if (!decomposition) {
      return null
    }
    try {
      const parsed =
        typeof decomposition === 'string'
          ? JSON.parse(decomposition)
          : decomposition
      return decompositionSchema.parse(parsed)
    } catch {
      return null
    }
  }

  const decomposition = parseDecomposition(story.story?.decomposition)
  const showDecompositionLoading =
    (!storyResult || isRunning) && decomposition !== null

  const conclusionContent = (() => {
    // Show decomposition data when results are still loading
    if (showDecompositionLoading && decomposition) {
      const requirementSteps =
        decomposition.steps.filter((step) => step.type === 'requirement') ?? []

      if (requirementSteps.length === 0) {
        return (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            No decomposition steps available yet.
          </div>
        )
      }

      const loadingDisplay = getLoadingConclusionDisplay()

      return (
        <div className="space-y-4">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-primary">
              Evaluation in progress...
            </p>
            <p className="mt-1 text-muted-foreground">
              Showing expected steps and assertions from decomposition. Results
              will appear as evaluation completes.
            </p>
          </div>

          <div className="space-y-4">
            {requirementSteps.map((step, stepIndex) => (
              <details
                key={`decomp-step-${step.goal}-${stepIndex}`}
                className="group rounded-md border bg-muted/40 text-sm text-foreground"
              >
                <summary className="flex w-full cursor-pointer select-none items-center gap-2 px-3 py-3 text-left [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                  <loadingDisplay.Icon
                    aria-label={loadingDisplay.label}
                    className={cn(
                      'size-4 shrink-0',
                      loadingDisplay.iconClassName,
                    )}
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {step.goal}
                  </span>
                </summary>
                <div className="space-y-3 border-t px-3 py-3 text-sm text-foreground">
                  {step.assertions && step.assertions.length > 0 ? (
                    <div className="space-y-2">
                      {step.assertions.map((assertion, assertionIndex) => (
                        <div
                          key={`decomp-assertion-${step.goal}-${stepIndex}-${assertionIndex}`}
                          className="rounded-md border bg-background p-3 opacity-75"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {assertion}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground italic">
                            Evidence will appear when evaluation completes
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      )
    }

    if (!storyResult) {
      return (
        <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          No evaluation results available yet.
        </div>
      )
    }

    if (!analysis) {
      return (
        <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Evaluation completed without additional analysis details.
        </div>
      )
    }

    const status = analysis.status
    if (status !== 'pass' && status !== 'fail' && status !== 'error') {
      // Skip rendering conclusion for 'running' or 'skipped' status
      return null
    }

    const conclusionStyles = getConclusionStyles(status)

    return (
      <div className="space-y-4">
        {status === 'fail' || status === 'error' ? (
          <div
            className={cn(
              'rounded-md border p-4 sm:p-5',
              conclusionStyles.container,
            )}
          >
            <p className="text-sm font-semibold text-foreground">
              {conclusionStyles.label}
            </p>
            <p className="mt-2 text-sm text-foreground">
              {analysis.explanation}
            </p>
          </div>
        ) : null}

        {(() => {
          // Filter out given steps - only show requirement steps
          const requirementSteps =
            analysis.steps?.filter((step) => step.type === 'requirement') ?? []

          // Don't render if there are no requirement steps
          if (requirementSteps.length === 0) {
            return null
          }

          // Group steps by goal (for requirement steps, goal is the outcome)
          const stepsByGoal = new Map<string, typeof requirementSteps>()

          requirementSteps.forEach((step) => {
            const goal = step.outcome

            if (!stepsByGoal.has(goal)) {
              stepsByGoal.set(goal, [])
            }
            stepsByGoal.get(goal)!.push(step)
          })

          return (
            <div className="space-y-4">
              {Array.from(stepsByGoal.entries()).map(([goal, steps]) => (
                <div key={goal} className="space-y-3">
                  <div className="space-y-2">
                    {steps.map((step, stepIndex) => {
                      const conclusionDisplay = getEvidenceConclusionDisplay(
                        step.conclusion === 'pass' ? 'pass' : 'fail',
                      )

                      return (
                        <details
                          key={`${storyResult.id}-step-${goal}-${stepIndex}`}
                          className="group rounded-md border bg-muted/40 text-sm text-foreground"
                        >
                          <summary className="flex w-full cursor-pointer select-none items-center gap-2 px-3 py-3 text-left [&::-webkit-details-marker]:hidden">
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                            <conclusionDisplay.Icon
                              aria-label={conclusionDisplay.label}
                              className={cn(
                                'size-4 shrink-0',
                                conclusionDisplay.iconClassName,
                              )}
                            />
                            <span className="truncate text-sm font-medium text-foreground">
                              {step.outcome}
                            </span>
                          </summary>
                          <div className="space-y-3 border-t px-3 py-3 text-sm text-foreground">
                            {step.assertions && step.assertions.length > 0 ? (
                              <div className="space-y-2">
                                {step.assertions.map(
                                  (assertion, assertionIndex) => (
                                    <div
                                      key={`${storyResult.id}-assertion-${goal}-${stepIndex}-${assertionIndex}`}
                                      className="rounded-md border bg-background p-3"
                                    >
                                      <div className="text-sm font-medium text-foreground">
                                        {assertion.fact}
                                      </div>
                                      {assertion.evidence &&
                                      assertion.evidence.length > 0 ? (
                                        <div className="mt-2 space-y-1">
                                          <div className="text-xs font-medium text-muted-foreground">
                                            Evidence:
                                          </div>
                                          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                                            {assertion.evidence.map(
                                              (ev, evIndex) => {
                                                const { text, url } =
                                                  parseEvidenceToGitHubLink(
                                                    ev,
                                                    orgName,
                                                    repoName,
                                                    commitSha,
                                                  )
                                                return (
                                                  <li key={evIndex}>
                                                    {url ? (
                                                      <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline"
                                                      >
                                                        {text}
                                                      </a>
                                                    ) : (
                                                      text
                                                    )}
                                                  </li>
                                                )
                                              },
                                            )}
                                          </ul>
                                        </div>
                                      ) : null}
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : null}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    )
  })()

  return <div className="w-full space-y-4">{conclusionContent}</div>
}

