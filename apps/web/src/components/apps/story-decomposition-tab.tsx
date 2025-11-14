import { Button } from '@/components/ui/button'

interface StoryDecompositionTabProps {
  decomposition: any
  isDecomposing: boolean
  onDecompose: () => void
}

export function StoryDecompositionTab({
  decomposition,
  isDecomposing,
  onDecompose,
}: StoryDecompositionTabProps) {
  return (
    <div className="flex h-full">
      <div className="w-1/2 p-6 overflow-auto border-r">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p
              className="text-sm font-semibold tracking-[0.3em] text-primary mb-2"
              title="Bunkai - to break down."
            >
              ぶんかい
            </p>
            <h2 className="mb-0">Decomposition</h2>
          </div>
          <Button
            variant="outline"
            onClick={onDecompose}
            disabled={isDecomposing}
          >
            {isDecomposing ? 'Decomposing...' : 'Decompose'}
          </Button>
        </div>
        <div className="mt-3">
          {decomposition ? (
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
              {JSON.stringify(decomposition, null, 2)}
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
  )
}

