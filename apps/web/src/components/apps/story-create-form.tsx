import { FileText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TiptapEditor } from '@/components/ui/tiptap-editor'

interface StoryCreateFormProps {
  storyContent: string
  createMore: boolean
  isSaving: boolean
  onContentChange: (content: string) => void
  onCreateMoreChange: (checked: boolean) => void
  onSave: () => void
  onCancel: () => void
  onTemplates: () => void
}

export function StoryCreateForm({
  storyContent,
  createMore,
  isSaving,
  onContentChange,
  onCreateMoreChange,
  onSave,
  onCancel,
  onTemplates,
}: StoryCreateFormProps) {
  return (
    <div className="flex items-center justify-center min-h-full p-12">
      <div className="w-full max-w-3xl">
        <div className="mb-6">
          <p
            className="text-sm font-semibold tracking-[0.3em] text-primary mb-2"
            title="Sakusei - to create."
          >
            さくせい
          </p>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-display text-foreground">
              Craft new user story
            </h1>
            <Button
              variant="outline"
              onClick={() => {
                // TODO: Implement story generation
              }}
              className="gap-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 hover:from-primary/20 hover:via-primary/10 hover:to-primary/20 hover:border-primary/50 transition-all shadow-sm hover:shadow-md backdrop-blur-sm relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent shimmer-effect"></span>
              <Sparkles className="h-4 w-4 text-primary relative z-10" />
              <span className="relative z-10">Generate Story</span>
            </Button>
          </div>
        </div>
        <TiptapEditor
          value={storyContent}
          onChange={onContentChange}
          className="min-h-96 max-h-[600px]"
        />
        <div className="mt-4 flex items-center justify-between pt-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={createMore}
                onChange={(e) => onCreateMoreChange(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Create more
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onTemplates}
              disabled={isSaving}
            >
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Create'}
              {!isSaving && (
                <span className="ml-2 text-xs opacity-60">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

