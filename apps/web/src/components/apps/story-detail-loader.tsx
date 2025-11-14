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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  const [isDecomposing, setIsDecomposing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

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
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsDecomposing(true)
                      setError(null)
                      try {
                        await trpc.story.decompose.mutate({ storyId })
                        // Reload story to get updated decomposition
                        const resp = await trpc.story.get.query({
                          orgName,
                          repoName,
                          storyId,
                        })
                        if (resp.story) {
                          setStory(resp.story)
                        }
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'Failed to start decomposition',
                        )
                      } finally {
                        setIsDecomposing(false)
                      }
                    }}
                    disabled={isDecomposing}
                  >
                    {isDecomposing ? 'Decomposing...' : 'Decompose'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsTesting(true)
                      setError(null)
                      try {
                        await trpc.story.test.mutate({ storyId })
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'Failed to start test',
                        )
                      } finally {
                        setIsTesting(false)
                      }
                    }}
                    disabled={isTesting}
                  >
                    {isTesting ? 'Testing...' : 'Test'}
                  </Button>
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
          <div className="flex flex-1 overflow-hidden flex-col">
            <Tabs
              defaultValue="story"
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="px-6 pt-4">
                <TabsList>
                  <TabsTrigger value="story">Story</TabsTrigger>
                  <TabsTrigger value="decomposition">Decomposition</TabsTrigger>
                  <TabsTrigger value="runs">Recent Runs</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="story" className="flex-1 overflow-auto mt-0">
                <div className="flex items-center justify-center min-h-full p-12">
                  <div className="w-full max-w-3xl">
                    <p
                      className="text-sm font-semibold tracking-[0.3em] text-primary mb-2"
                      title="Riyōsha no sutōrī - story of the user."
                    >
                      利用者のストーリー
                    </p>
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
                        'w-full h-96 resize-none rounded-md border border-input bg-card p-4 text-sm text-card-foreground shadow-sm',
                        'placeholder:text-muted-foreground',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        !isEditing && 'bg-muted/50',
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent
                value="decomposition"
                className="flex-1 overflow-hidden mt-0"
              >
                <div className="flex h-full">
                  <div className="w-1/2 p-6 overflow-auto border-r">
                    <p
                      className="text-sm font-semibold tracking-[0.3em] text-primary mb-2"
                      title="Bunkai - to break down."
                    >
                      ぶんかい
                    </p>
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
                  <div className="w-1/2 p-6 overflow-auto">
                    {/* Placeholder for code section - to be implemented later */}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="runs" className="flex-1 overflow-auto mt-0">
                <div className="p-6">
                  {/* Placeholder for recent runs - to be implemented later */}
                  <div className="text-sm text-muted-foreground">
                    Recent runs will be displayed here.
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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
