import { Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TiptapEditor } from '@/components/ui/tiptap-editor'

interface StoryEditFormProps {
  storyName: string
  storyContent: string
  hasChanges: boolean
  isSaving: boolean
  onContentChange: (content: string) => void
  onSave: () => void
  onCancel: () => void
  onArchive: () => void
}

export function StoryEditForm({
  storyName,
  storyContent,
  hasChanges,
  isSaving,
  onContentChange,
  onSave,
  onCancel,
  onArchive,
}: StoryEditFormProps) {
  return (
    <div className="flex items-center justify-center min-h-full p-12">
      <div className="w-full max-w-3xl">
        <div className="mb-6">
          <p
            className="text-sm font-semibold tracking-[0.3em] text-primary mb-2"
            title="Henshuu - to edit."
          >
            へんしゅう
          </p>
          <h1 className="text-2xl font-display text-foreground">{storyName}</h1>
        </div>
        <TiptapEditor
          value={storyContent}
          onChange={onContentChange}
          className="min-h-96 max-h-[600px]"
        />
        <div className="mt-4 flex items-center justify-between pt-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={isSaving || !hasChanges}
              variant={!hasChanges ? 'outline' : 'default'}
            >
              {isSaving
                ? 'Saving...'
                : !hasChanges
                  ? 'No changes made'
                  : 'Save Changes'}
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

