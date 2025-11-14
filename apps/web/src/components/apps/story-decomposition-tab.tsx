import { Play } from 'lucide-react'
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
            <h1 className="text-2xl font-display text-foreground">
              Intent Composition
            </h1>
          </div>
          <Button
            variant="outline"
            onClick={onDecompose}
            disabled={isDecomposing}
          >
            {isDecomposing ? 'Transcribing...' : 'Re-transcribe'}
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
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <p
            className="text-sm font-semibold tracking-[0.3em] text-primary mb-4"
            title="Genpon - original source."
          >
            げんぽん
          </p>
          <h2 className="text-2xl font-display text-foreground mb-3">
            Backed by source
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md">
            View the source code and implementation details that back this
            intent composition. See how your stories are translated into actual
            code changes and understand the connection between intent and
            implementation.
          </p>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              window.alert('Coming soon')
            }}
          >
            <Play className="h-4 w-4" />
            Run intent test
          </Button>
        </div>
      </div>
    </div>
  )
}
