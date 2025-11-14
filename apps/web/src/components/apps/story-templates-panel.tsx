import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { cn } from '@/lib/utils'

export interface StoryTemplate {
  id: string
  title: string
  content: string
}

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'classic',
    title: '🧩 Classic User Story Format (Agile Standard)',
    content: `<h3>Structure</h3><p>As a <strong>[type of user]</strong>,<br>I want <strong>[some goal]</strong>,<br>so that <strong>[some reason]</strong>.</p><h3>Example</h3><p>As a registered user,<br>I want to reset my password,<br>so that I can regain access to my account if I forget it.</p><h4>Acceptance Criteria</h4><ul><li>User can request a password reset via email.</li><li>Email contains a unique, one-time-use link.</li><li>Link expires after 15 minutes.</li></ul>`,
  },
  {
    id: 'gherkin',
    title: '🧠 Gherkin / BDD (Behavior-Driven Development)',
    content: `<h3>Structure</h3><pre><code>Feature: [Feature Name]
  As a [user type]
  I want [goal]
  So that [benefit]

  Scenario: [Scenario Name]
    Given [initial context]
    When [event or action]
    Then [expected outcome]</code></pre><h3>Example</h3><pre><code>Feature: Password Reset
  As a registered user
  I want to reset my password
  So that I can regain access to my account

  Scenario: Successful password reset
    Given I am on the "Forgot Password" page
    When I enter my email and click "Send Reset Link"
    Then I should receive a reset link in my email</code></pre><h4>Acceptance Criteria</h4><ul><li>All "Given/When/Then" scenarios pass via automated tests.</li></ul>`,
  },
  {
    id: 'feature-story',
    title: '🧱 Feature Story with Acceptance Criteria (Structured List)',
    content: `<h3>Structure</h3><p><strong>Title:</strong> [Feature Title]<br><strong>Description:</strong> [Short summary]<br><strong>User Story:</strong> As a [user], I want [goal], so that [reason]</p><h4>Acceptance Criteria:</h4><ul><li>[Criterion 1]</li><li>[Criterion 2]</li><li>[Criterion 3]</li></ul><h3>Example</h3><p><strong>Title:</strong> Email Verification<br><strong>Description:</strong> Require users to verify email after registration.<br><strong>User Story:</strong> As a new user, I want to verify my email, so that my account is confirmed.</p><h4>Acceptance Criteria:</h4><ul><li>Verification link sent upon registration</li><li>Clicking link sets 'email_verified = true'</li><li>Expired links show an error message</li></ul>`,
  },
  {
    id: 'job-story',
    title: '⚙️ "Job Story" Format (Intercom-style, Context-driven)',
    content: `<h3>Structure</h3><p>When <strong>[situation]</strong>,<br>I want to <strong>[motivation]</strong>,<br>so I can <strong>[expected outcome]</strong>.</p><h3>Example</h3><p>When I forget my password,<br>I want to receive a reset link instantly,<br>so I can quickly log back into my account.</p><blockquote><p><strong>Use Case</strong><br>Job stories focus on context and motivation rather than persona; great for product UX work.</p></blockquote>`,
  },
  {
    id: 'bdd-extended',
    title: '💬 BDD Extended (Given/When/Then + And)',
    content: `<h3>Structure</h3><pre><code>Scenario: [Scenario Name]
  Given [precondition]
  And [another precondition]
  When [action]
  And [another action]
  Then [expected outcome]
  And [another outcome]</code></pre><h3>Example</h3><pre><code>Scenario: Multiple invalid login attempts
  Given I am on the login page
  And I have entered an incorrect password 3 times
  When I try to log in again
  Then my account should be temporarily locked
  And I should see an error message</code></pre>`,
  },
  {
    id: 'spec-by-example',
    title: '🧩 Specification by Example (Concrete Use Cases)',
    content: `<h3>Structure</h3><p>A table or matrix of concrete examples used to define behavior.</p><h3>Example</h3><p><strong>Feature:</strong> Login validation</p><pre><code>Example:
| Input Email        | Input Password | Expected Result        |
|--------------------|----------------|------------------------|
| valid@email.com    | correct123     | Login successful       |
| valid@email.com    | wrongpass      | Error: Invalid password|
| invalid@email      | anypass        | Error: Invalid email   |</code></pre><p>Used with Cucumber, FitNesse, or other executable spec tools.</p>`,
  },
  {
    id: 'invest',
    title: '📋 INVEST-compliant Story Format',
    content: `<h3>Structure</h3><p>Ensures stories are:</p><p><strong>Independent</strong>, <strong>Negotiable</strong>, <strong>Valuable</strong>, <strong>Estimable</strong>, <strong>Small</strong>, <strong>Testable</strong></p><h4>Template</h4><p><strong>Story:</strong> [Title]<br><strong>Value:</strong> [Business reason or impact]<br><strong>Estimation:</strong> [Story points or complexity]</p><h4>Acceptance Tests:</h4><ul><li>[Behavior test or rule]</li></ul><h4>Notes:</h4><ul><li>[Open questions or dependencies]</li></ul>`,
  },
  {
    id: 'use-case',
    title: '💡 Use Case Narrative (UML-style)',
    content: `<h3>Structure</h3><p><strong>Use Case:</strong> [Name]<br><strong>Actor:</strong> [User or System]<br><strong>Preconditions:</strong> [What must be true before]</p><h4>Main Flow:</h4><ol><li>[Action 1]</li><li>[Action 2]</li></ol><h4>Alternative Flows:</h4><p>A1. [Error or edge case]</p><p><strong>Postconditions:</strong> [What must be true after]</p><h3>Example</h3><p><strong>Use Case:</strong> Reset Password<br><strong>Actor:</strong> User<br><strong>Precondition:</strong> User must have a valid registered email</p><h4>Main Flow:</h4><ol><li>User requests reset</li><li>System sends link</li><li>User resets password</li></ol><p><strong>Postcondition:</strong> Password updated successfully</p>`,
  },
  {
    id: 'atdd',
    title: '🧭 Acceptance Test-Driven Development (ATDD) Story',
    content: `<h3>Structure</h3><p><strong>Story:</strong> [Goal]<br><strong>Test:</strong> [Acceptance test description]<br><strong>Expected Outcome:</strong> [Result]</p><h3>Example</h3><p><strong>Story:</strong> Reset Password via Email<br><strong>Test:</strong> Send reset link to registered email<br><strong>Expected Outcome:</strong> User receives email with valid link</p>`,
  },
  {
    id: 'hybrid',
    title: '🧰 Hybrid Story (for Agile AI / Agentic Systems)',
    content: `<h3>Structure</h3><p><strong>Story:</strong><br>  <strong>As:</strong> AI reviewer agent<br>  <strong>I want:</strong> verify repository implements user story<br>  <strong>So that:</strong> developers can confirm feature completion</p><h4>Acceptance Criteria:</h4><ul><li>Search finds relevant code symbols</li><li>Each step is evaluated with evidence</li><li>Verdict is structured JSON with explanation</li></ul>`,
  },
]

interface StoryTemplatesPanelProps {
  onSelectTemplate: (template: StoryTemplate) => void
}

export function StoryTemplatesPanel({
  onSelectTemplate,
}: StoryTemplatesPanelProps) {
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)

  return (
    <div className="flex-1 flex flex-col overflow-hidden border rounded-md min-h-0">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-medium text-foreground">Story Templates</h2>
        <p className="text-xs text-muted-foreground mt-1">
          The templates below are suggested to help you get started, but you are
          free to write your story in any format you like—none of these are
          required.
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
                  onClick={() => setOpenTemplateId(isOpen ? null : template.id)}
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
                  onClick={() => onSelectTemplate(template)}
                >
                  Use Template
                </Button>
              </div>
              {isOpen ? (
                <div id={contentId} className="px-4 pb-4">
                  <TiptapEditor
                    value={template.content}
                    onChange={() => {}}
                    readOnly={true}
                    className="min-h-[200px]"
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
