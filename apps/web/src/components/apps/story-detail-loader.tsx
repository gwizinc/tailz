import { useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

interface Story {
  id: string
  name: string
  story: string
  createdAt: Date | string | null
  updatedAt: Date | string | null
  // TODO we cannot import from agents :(
  decomposition: any
}

export function StoryDetailLoader({
  orgName,
  repoName,
  storyId,
}: {
  orgName: string
  repoName: string
  storyId: string
}) {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storyName, setStoryName] = useState('')
  const [storyContent, setStoryContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const resp = await trpc.story.get.query({ orgName, repoName, storyId })
        if (!isMounted) {
          return
        }
        if (resp.story) {
          setStory(resp.story)
          setStoryName(resp.story.name)
          setStoryContent(resp.story.story)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load story')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [trpc, orgName, repoName, storyId])

  return (
    <AppLayout
      breadcrumbs={[
        { label: orgName, href: `/org/${orgName}` },
        { label: repoName, href: `/org/${orgName}/repo/${repoName}` },
      ]}
    >
      {isLoading ? (
        <LoadingProgress label="Loading story..." />
      ) : error ? (
        <div className="p-6 text-sm text-red-500">{error}</div>
      ) : story ? (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex-1">
              {isEditing ? (
                <div className="grid gap-2">
                  <Label htmlFor="editStoryName">Story Title</Label>
                  <Input
                    id="editStoryName"
                    value={storyName}
                    onChange={(e) => setStoryName(e.target.value)}
                  />
                </div>
              ) : (
                <h1 className="text-xl font-semibold text-foreground">
                  {story.name}
                </h1>
              )}
            </div>
            <div className="flex gap-2 items-center">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setStoryName(story.name)
                      setStoryContent(story.story)
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      setIsSaving(true)
                      setError(null)
                      try {
                        const result = await trpc.story.update.mutate({
                          orgName,
                          repoName,
                          storyId,
                          name: storyName,
                          story: storyContent,
                        })
                        setStory(result.story)
                        setIsEditing(false)
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'Failed to update story',
                        )
                      } finally {
                        setIsSaving(false)
                      }
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
          {error && (
            <div className="mx-6 mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="flex flex-1 overflow-hidden">
            <div className="w-1/2 p-6 overflow-auto border-r flex flex-col">
              <Label htmlFor="storyContent" className="mb-2">
                Story Content
              </Label>
              <textarea
                id="storyContent"
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
                readOnly={!isEditing}
                placeholder={isEditing ? 'Write your story here...' : ''}
                className={cn(
                  'flex-1 w-full resize-none rounded-md border border-input bg-card p-4 text-sm text-card-foreground shadow-sm',
                  'placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  !isEditing && 'bg-muted/50',
                )}
              />
            </div>
            <div className="w-1/2 p-6 overflow-auto">
              <h2 className="mb-4">Decomposition</h2>
              <div className="mt-3">
                {story.decomposition ? (
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                    {JSON.stringify(story.decomposition, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No decomposition data available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Story</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{story?.name}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setIsDeleting(true)
                setError(null)
                try {
                  await trpc.story.delete.mutate({
                    orgName,
                    repoName,
                    storyId,
                  })
                  window.location.href = `/org/${orgName}/repo/${repoName}`
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'Failed to delete story',
                  )
                  setIsDeleting(false)
                  setShowDeleteDialog(false)
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
