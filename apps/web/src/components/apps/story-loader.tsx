import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useStoryDraft } from '@/hooks/use-story-draft'
import { StoryArchiveDialog } from '@/components/apps/story-archive-dialog'
import { StoryTemplatesDialog } from '@/components/apps/story-templates-dialog'
import { StoryEditForm } from '@/components/apps/story-edit-form'
import { StoryCreateForm } from '@/components/apps/story-create-form'
import { StoryDecompositionTab } from '@/components/apps/story-decomposition-tab'
import { StoryRunsTab } from '@/components/apps/story-runs-tab'

interface Story {
  id: string
  name: string
  story: string
  createdAt: Date | string | null
  updatedAt: Date | string | null
  // TODO we cannot import from agents :(
  decomposition: any
}

interface StoryLoaderProps {
  orgName: string
  repoName: string
  storyId?: string
}

export function StoryLoader({ orgName, repoName, storyId }: StoryLoaderProps) {
  const trpc = useTRPCClient()
  const isCreateMode = !storyId

  // Constants
  const draftStorageKey = `story-draft-${orgName}-${repoName}`

  // Loading and error states
  const [isLoading, setIsLoading] = useState(!isCreateMode)
  const [error, setError] = useState<string | null>(null)

  // Story data states
  const [story, setStory] = useState<Story | null>(null)

  // Use draft hook for create mode
  const {
    storyName,
    setStoryName,
    storyContent,
    setStoryContent,
    originalStoryContent,
    setOriginalStoryContent,
    clearDraft,
  } = useStoryDraft(draftStorageKey, isCreateMode)

  // UI state (dialogs and flags)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false)
  const [createMore, setCreateMore] = useState(false)

  // Action states
  const [isSaving, setIsSaving] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDecomposing, setIsDecomposing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  // Derived values
  const hasChanges = storyContent !== originalStoryContent
  const breadcrumbs = [
    { label: orgName, href: `/org/${orgName}` },
    { label: repoName, href: `/org/${orgName}/repo/${repoName}` },
  ]

  // Load story in edit mode
  useEffect(() => {
    if (isCreateMode) {
      return
    }

    let isMounted = true
    async function load() {
      try {
        const resp = await trpc.story.get.query({
          orgName,
          repoName,
          storyId: storyId!,
        })
        if (!isMounted) {
          return
        }
        if (resp.story) {
          setStory(resp.story)
          setStoryName(resp.story.name)
          setStoryContent(resp.story.story)
          setOriginalStoryContent(resp.story.story)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trpc, orgName, repoName, storyId, isCreateMode])

  const handleSave = async () => {
    if (!storyContent.trim()) {
      setError('Story content is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      if (isCreateMode) {
        await trpc.story.create.mutate({
          orgName,
          repoName,
          name: storyName.trim() || undefined,
          story: storyContent,
          files: [],
        })
      } else {
        const result = await trpc.story.update.mutate({
          orgName,
          repoName,
          storyId: storyId,
          name: storyName,
          story: storyContent,
        })
        setStory(result.story)
        setOriginalStoryContent(storyContent)
        setIsSaving(false)
        return
      }

      // Clear draft from localStorage after successful creation
      clearDraft()

      // If "create more" is checked, reset the form and stay on the page
      if (createMore) {
        setStoryContent('')
        setOriginalStoryContent('')
        setIsSaving(false)
        toast.success('Story created.')
        return // Early return to prevent any navigation
      }

      // Otherwise, navigate back to the repository page
      window.location.href = `/org/${orgName}/repo/${repoName}`
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isCreateMode
            ? 'Failed to create story'
            : 'Failed to update story',
      )
      setIsSaving(false)
    }
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not already prevented and editor might be focused
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // Prevent default to stop TipTap from inserting newline
        e.preventDefault()
        e.stopPropagation()
        if (!isSaving && (isCreateMode || hasChanges)) {
          void handleSave()
        }
      }
    }

    // Use capture phase to catch the event before TipTap handles it
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving, isCreateMode, hasChanges])

  const handleCancel = () => {
    if (isCreateMode) {
      // Don't clear draft on cancel - user might come back
      window.history.back()
    } else {
      setStoryContent(originalStoryContent)
    }
  }

  const handleArchive = async () => {
    setIsArchiving(true)
    setError(null)
    try {
      await trpc.story.archive.mutate({
        orgName,
        repoName,
        storyId: storyId!,
      })
      window.location.href = `/org/${orgName}/repo/${repoName}`
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive story')
      setIsArchiving(false)
      setShowArchiveDialog(false)
    }
  }

  const handleDecompose = async () => {
    if (!storyId) {
      return
    }
    setIsDecomposing(true)
    setError(null)
    try {
      await trpc.story.decompose.mutate({
        storyId: storyId,
      })
      // Reload story to get updated decomposition
      const resp = await trpc.story.get.query({
        orgName,
        repoName,
        storyId: storyId,
      })
      if (resp.story) {
        setStory(resp.story)
        setStoryContent(resp.story.story)
        setOriginalStoryContent(resp.story.story)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start decomposition')
    } finally {
      setIsDecomposing(false)
    }
  }

  const handleTest = async () => {
    if (!storyId) {
      return
    }
    setIsTesting(true)
    setError(null)
    try {
      await trpc.story.test.mutate({
        storyId: storyId,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start test')
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: orgName, href: `/org/${orgName}` },
          { label: repoName, href: `/org/${orgName}/repo/${repoName}` },
        ]}
      >
        <LoadingProgress label="Loading story..." />
      </AppLayout>
    )
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .shimmer-effect {
          animation: shimmer 3s infinite;
        }
      `}</style>
      {error && (
        <div className="mx-6 mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}
      {isCreateMode || story ? (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex flex-1 overflow-hidden flex-col">
            {!isCreateMode ? (
              <Tabs
                defaultValue="story"
                className="flex flex-1 flex-col overflow-hidden"
              >
                <div className="px-6 pt-4 flex items-center justify-center">
                  <TabsList>
                    <TabsTrigger value="story">Story</TabsTrigger>
                    <TabsTrigger value="decomposition">
                      Decomposition
                    </TabsTrigger>
                    <TabsTrigger value="runs">Recent Runs</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent
                  value="story"
                  className="flex-1 overflow-auto mt-0"
                >
                  <StoryEditForm
                    storyName={storyName}
                    storyContent={storyContent}
                    hasChanges={hasChanges}
                    isSaving={isSaving}
                    onContentChange={setStoryContent}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onArchive={() => setShowArchiveDialog(true)}
                  />
                </TabsContent>
                <TabsContent
                  value="decomposition"
                  className="flex-1 overflow-hidden mt-0"
                >
                  <StoryDecompositionTab
                    decomposition={story?.decomposition}
                    isDecomposing={isDecomposing}
                    onDecompose={handleDecompose}
                  />
                </TabsContent>
                <TabsContent value="runs" className="flex-1 overflow-auto mt-0">
                  <StoryRunsTab isTesting={isTesting} onTest={handleTest} />
                </TabsContent>
              </Tabs>
            ) : (
              <StoryCreateForm
                storyContent={storyContent}
                createMore={createMore}
                isSaving={isSaving}
                onContentChange={setStoryContent}
                onCreateMoreChange={setCreateMore}
                onSave={handleSave}
                onCancel={handleCancel}
                onTemplates={() => setShowTemplatesDialog(true)}
              />
            )}
          </div>
        </div>
      ) : null}
      <StoryTemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        onSelectTemplate={(content) => {
          setStoryContent(content)
        }}
      />
      <StoryArchiveDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        storyName={story?.name ?? null}
        isArchiving={isArchiving}
        onArchive={handleArchive}
      />
    </AppLayout>
  )
}
