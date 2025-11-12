import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { LuOrigami } from 'react-icons/lu'
import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StoryTemplate {
  id: string
  title: string
  content: string
}

const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'classic',
    title: '🧩 Classic User Story Format (Agile Standard)',
    content: `Structure\n\nAs a [type of user],\nI want [some goal],\nso that [some reason].\n\nExample\n\nAs a registered user,\nI want to reset my password,\nso that I can regain access to my account if I forget it.\n\nAcceptance Criteria\n- User can request a password reset via email.\n- Email contains a unique, one-time-use link.\n- Link expires after 15 minutes.`,
  },
  {
    id: 'gherkin',
    title: '🧠 Gherkin / BDD (Behavior-Driven Development)',
    content: `Structure\n\nFeature: [Feature Name]\n  As a [user type]\n  I want [goal]\n  So that [benefit]\n\n  Scenario: [Scenario Name]\n    Given [initial context]\n    When [event or action]\n    Then [expected outcome]\n\nExample\n\nFeature: Password Reset\n  As a registered user\n  I want to reset my password\n  So that I can regain access to my account\n\n  Scenario: Successful password reset\n    Given I am on the "Forgot Password" page\n    When I enter my email and click "Send Reset Link"\n    Then I should receive a reset link in my email\n\nAcceptance Criteria\n- All "Given/When/Then" scenarios pass via automated tests.`,
  },
  {
    id: 'feature-story',
    title: '🧱 Feature Story with Acceptance Criteria (Structured List)',
    content: `Structure\n\nTitle: [Feature Title]\nDescription: [Short summary]\nUser Story: As a [user], I want [goal], so that [reason]\nAcceptance Criteria:\n  - [Criterion 1]\n  - [Criterion 2]\n  - [Criterion 3]\n\nExample\n\nTitle: Email Verification\nDescription: Require users to verify email after registration.\nUser Story: As a new user, I want to verify my email, so that my account is confirmed.\nAcceptance Criteria:\n  - Verification link sent upon registration\n  - Clicking link sets 'email_verified = true'\n  - Expired links show an error message`,
  },
  {
    id: 'job-story',
    title: '⚙️ “Job Story” Format (Intercom-style, Context-driven)',
    content: `Structure\n\nWhen [situation],\nI want to [motivation],\nso I can [expected outcome].\n\nExample\n\nWhen I forget my password,\nI want to receive a reset link instantly,\nso I can quickly log back into my account.\n\nUse Case\nJob stories focus on context and motivation rather than persona; great for product UX work.`,
  },
  {
    id: 'bdd-extended',
    title: '💬 BDD Extended (Given/When/Then + And)',
    content: `Structure\n\nScenario: [Scenario Name]\n  Given [precondition]\n  And [another precondition]\n  When [action]\n  And [another action]\n  Then [expected outcome]\n  And [another outcome]\n\nExample\n\nScenario: Multiple invalid login attempts\n  Given I am on the login page\n  And I have entered an incorrect password 3 times\n  When I try to log in again\n  Then my account should be temporarily locked\n  And I should see an error message`,
  },
  {
    id: 'spec-by-example',
    title: '🧩 Specification by Example (Concrete Use Cases)',
    content: `Structure\n\nA table or matrix of concrete examples used to define behavior.\n\nExample\n\nFeature: Login validation\n\nExample:\n| Input Email        | Input Password | Expected Result        |\n|--------------------|----------------|------------------------|\n| valid@email.com    | correct123     | Login successful       |\n| valid@email.com    | wrongpass      | Error: Invalid password|\n| invalid@email      | anypass        | Error: Invalid email   |\n\nUsed with Cucumber, FitNesse, or other executable spec tools.`,
  },
  {
    id: 'invest',
    title: '📋 INVEST-compliant Story Format',
    content: `Structure\n\nEnsures stories are:\nIndependent, Negotiable, Valuable, Estimable, Small, Testable\n\nTemplate\n\nStory: [Title]\nValue: [Business reason or impact]\nEstimation: [Story points or complexity]\nAcceptance Tests:\n  - [Behavior test or rule]\nNotes:\n  - [Open questions or dependencies]`,
  },
  {
    id: 'use-case',
    title: '💡 Use Case Narrative (UML-style)',
    content: `Structure\n\nUse Case: [Name]\nActor: [User or System]\nPreconditions: [What must be true before]\nMain Flow:\n  1. [Action 1]\n  2. [Action 2]\nAlternative Flows:\n  A1. [Error or edge case]\nPostconditions: [What must be true after]\n\nExample\n\nUse Case: Reset Password\nActor: User\nPrecondition: User must have a valid registered email\nMain Flow:\n  1. User requests reset\n  2. System sends link\n  3. User resets password\nPostcondition: Password updated successfully`,
  },
  {
    id: 'atdd',
    title: '🧭 Acceptance Test-Driven Development (ATDD) Story',
    content: `Structure\n\nStory: [Goal]\nTest: [Acceptance test description]\nExpected Outcome: [Result]\n\nExample\n\nStory: Reset Password via Email\nTest: Send reset link to registered email\nExpected Outcome: User receives email with valid link`,
  },
  {
    id: 'hybrid',
    title: '🧰 Hybrid Story (for Agile AI / Agentic Systems)',
    content: `Structure\n\nStory:\n  As: AI reviewer agent\n  I want: verify repository implements user story\n  So that: developers can confirm feature completion\n\nAcceptance Criteria:\n  - Search finds relevant code symbols\n  - Each step is evaluated with evidence\n  - Verdict is structured JSON with explanation`,
  },
]

export function StoryCreateLoader({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  const trpc = useTRPCClient()
  const [storyName, setStoryName] = useState('')
  const [storyContent, setStoryContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(
    STORY_TEMPLATES[0]?.id ?? null,
  )
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const handleSave = async () => {
    if (!storyName.trim() || !storyContent.trim()) {
      setError('Story name and content are required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await trpc.story.create.mutate({
        orgSlug,
        repoName,
        name: storyName.trim(),
        story: storyContent,
        files: [],
      })

      // Navigate back to the repository page after creating the story
      window.location.href = `/org/${orgSlug}/repo/${repoName}`
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create story')
      setIsSaving(false)
    }
  }

  const handleTemplateSelect = (template: StoryTemplate) => {
    setStoryContent(template.content)
    textareaRef.current?.focus()
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: orgSlug, href: `/org/${orgSlug}` },
        { label: repoName, href: `/org/${orgSlug}/repo/${repoName}` },
        { label: 'New Story', href: '#' },
      ]}
    >
      <div className="p-6 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-2">
            <LuOrigami
              aria-hidden="true"
              className="h-5 w-5 text-muted-foreground"
            />
            <h1 className="text-xl font-semibold text-foreground">
              Create New Story
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Story'}
            </Button>
          </div>
        </div>
        <div className="mb-6 shrink-0">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="storyName">Story Title</Label>
              <Input
                id="storyName"
                value={storyName}
                onChange={(e) => setStoryName(e.target.value)}
                placeholder="Enter story title..."
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md shrink-0">
            {error}
          </div>
        )}

        <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
          {/* Left Panel: Story Editor */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <Label htmlFor="storyEditor" className="mb-2 shrink-0">
              Story Content
            </Label>
            <textarea
              id="storyEditor"
              ref={textareaRef}
              value={storyContent}
              onChange={(e) => setStoryContent(e.target.value)}
              placeholder="Write your story here..."
              className={cn(
                'flex-1 w-full resize-none rounded-md border border-input bg-card p-4 text-sm text-card-foreground shadow-sm',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          </div>

          {/* Right Panel: Story Templates */}
          <div className="flex-1 flex flex-col overflow-hidden border rounded-md min-h-0">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-medium text-foreground">
                Story Templates
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                The templates below are suggested to help you get started, but
                you are free to write your story in any format you like—none of
                these are required.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {STORY_TEMPLATES.map((template) => {
                const isOpen = openTemplateId === template.id
                const contentId = `story-template-${template.id}`
                return (
                  <div key={template.id} className="border-b last:border-b-0">
                    <div className="flex items-start gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenTemplateId(isOpen ? null : template.id)
                        }
                        className={cn(
                          'flex-1 text-left text-sm font-medium text-foreground',
                          'flex items-center gap-2',
                          'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm',
                        )}
                        aria-expanded={isOpen}
                        aria-controls={contentId}
                      >
                        <span className="flex-1">{template.title}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                            isOpen ? '' : '-rotate-90',
                          )}
                        />
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleTemplateSelect(template)}
                      >
                        Use Template
                      </Button>
                    </div>
                    {isOpen ? (
                      <div
                        id={contentId}
                        className="px-4 pb-4 text-xs text-muted-foreground whitespace-pre-wrap font-mono"
                      >
                        {template.content}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = `/org/${orgSlug}/repo/${repoName}`
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
