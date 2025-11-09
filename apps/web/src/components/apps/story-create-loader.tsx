import { useState, useEffect } from 'react'
import { GitBranch } from 'lucide-react'
import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { StoryEditor } from '@/components/stories/StoryEditor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BranchItem {
  name: string
  headSha?: string
  updatedAt?: string
}

export function StoryCreateLoader({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [commitSha, setCommitSha] = useState<string | null>(null)
  const [storyName, setStoryName] = useState('')
  const [storyContent, setStoryContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get branch from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const branchParam = params.get('branch')
    if (branchParam) {
      setSelectedBranch(branchParam)
    }
  }, [])

  // Load branches and set initial branch/commit
  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const branchesResp = await trpc.branch.listByRepo.query({
          orgSlug,
          repoName,
        })
        if (!isMounted) {
          return
        }

        setBranches(branchesResp.branches)

        // Set selected branch if not already set
        if (!selectedBranch && branchesResp.branches.length > 0) {
          const branch = branchesResp.branches[0]
          setSelectedBranch(branch.name)
          setCommitSha(branch.headSha || null)
        } else if (selectedBranch) {
          // Find the selected branch and set commit SHA
          const branch = branchesResp.branches.find(
            (b) => b.name === selectedBranch,
          )
          if (branch) {
            setCommitSha(branch.headSha || null)
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load branches')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [trpc, orgSlug, repoName, selectedBranch])

  // Update commit SHA when branch changes
  useEffect(() => {
    if (!selectedBranch) {
      return
    }
    const branch = branches.find((b) => b.name === selectedBranch)
    if (branch) {
      setCommitSha(branch.headSha || null)
    }
  }, [selectedBranch, branches])

  const handleSave = async () => {
    if (!storyName.trim() || !storyContent.trim() || !selectedBranch) {
      setError('Story name, content, and branch are required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const result = await trpc.story.create.mutate({
        orgSlug,
        repoName,
        branchName: selectedBranch,
        commitSha,
        name: storyName.trim(),
        story: storyContent,
        files: [],
      })

      // Navigate to the story detail page
      window.location.href = `/org/${orgSlug}/repo/${repoName}/stories/${result.story.id}`
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create story')
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: orgSlug, href: `/org/${orgSlug}` },
          { label: repoName, href: `/org/${orgSlug}/repo/${repoName}` },
          { label: 'New Story', href: '#' },
        ]}
      >
        <LoadingProgress label="Loading..." />
      </AppLayout>
    )
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
          <h1 className="text-xl font-semibold text-foreground">
            Create New Story
          </h1>
          {branches.length > 0 && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <GitBranch className="h-4 w-4 shrink-0" />
                  <SelectValue placeholder="Select branch" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            <StoryEditor
              id="storyEditor"
              value={storyContent}
              onChange={setStoryContent}
              placeholder="Write your story here..."
              className="flex-1 min-h-0"
            />
          </div>

          {/* Right Panel: Code Discovery (Placeholder) */}
          <div className="flex-1 flex flex-col overflow-hidden border rounded-md p-4 min-h-0">
            <h2 className="text-sm font-medium text-foreground mb-4 shrink-0">
              Code Discovery
            </h2>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Code discovery tool coming soon...</p>
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
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Story'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
