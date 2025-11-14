import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface StoryArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storyName: string | null
  isArchiving: boolean
  onArchive: () => void
}

export function StoryArchiveDialog({
  open,
  onOpenChange,
  storyName,
  isArchiving,
  onArchive,
}: StoryArchiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Story</DialogTitle>
          <DialogDescription>
            Are you sure you want to archive &ldquo;{storyName}&rdquo;? The story
            will be hidden from the list but can be restored later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isArchiving}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onArchive} disabled={isArchiving}>
            {isArchiving ? 'Archiving...' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

