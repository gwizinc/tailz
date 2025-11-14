import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StoryTemplatesPanel } from '@/components/apps/story-templates-panel'

interface StoryTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTemplate: (content: string) => void
}

export function StoryTemplatesDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: StoryTemplatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Story Templates</DialogTitle>
          <DialogDescription>
            Choose a template to get started with your story. You can modify it
            after selecting.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-0">
          <StoryTemplatesPanel
            onSelectTemplate={(template) => {
              onSelectTemplate(template.content)
              onOpenChange(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

