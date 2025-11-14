import { Button } from '@/components/ui/button'

interface StoryRunsTabProps {
  isTesting: boolean
  onTest: () => void
}

export function StoryRunsTab({ isTesting, onTest }: StoryRunsTabProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Runs</h2>
        <Button variant="outline" onClick={onTest} disabled={isTesting}>
          {isTesting ? 'Testing...' : 'Test'}
        </Button>
      </div>
      {/* Placeholder for recent runs - to be implemented later */}
      <div className="text-sm text-muted-foreground">
        Recent runs will be displayed here.
      </div>
    </div>
  )
}

