import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { AppProvider } from '@/components/providers/app-provider'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function UpcomingFeaturesApp() {
  return (
    <AppProvider>
      <UpcomingFeaturesView />
    </AppProvider>
  )
}

interface Feature {
  id: string
  title: string
  description: string
  voteCount: number
  hasVoted: boolean
  createdAt: string
  updatedAt: string
}

function UpcomingFeaturesView() {
  const trpc = useTRPCClient()
  const [features, setFeatures] = useState<Feature[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeVoteId, setActiveVoteId] = useState<string | null>(null)

  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => {
      if (b.voteCount === a.voteCount) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return b.voteCount - a.voteCount
    })
  }, [features])

  useEffect(() => {
    let isMounted = true

    async function loadFeatures() {
      try {
        const data = await trpc.feature.list.query()
        if (!isMounted) {
          return
        }
        setFeatures(data.features)
      } catch (err) {
        if (!isMounted) {
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load features')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadFeatures()

    return () => {
      isMounted = false
    }
  }, [trpc])

  const handleVote = async (featureId: string) => {
    setError(null)
    setActiveVoteId(featureId)
    try {
      const result = await trpc.feature.vote.mutate({ featureId })
      setFeatures((prev) =>
        prev.map((feature) =>
          feature.id === featureId
            ? {
                ...feature,
                voteCount: result.feature.voteCount,
                hasVoted: result.feature.hasVoted,
              }
            : feature,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote')
    } finally {
      setActiveVoteId(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await trpc.feature.create.mutate({
        title,
        description,
      })
      setFeatures((prev) => [result.feature, ...prev])
      setTitle('')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <div className="flex h-full flex-col gap-6 overflow-auto p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Upcoming Features
          </h1>
          <p className="text-muted-foreground text-sm">
            Help us decide what to build next. Show your support for existing
            ideas or add a new one.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="grid gap-4 sm:grid-cols-2">
            {isLoading ? (
              <Card className="items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </Card>
            ) : sortedFeatures.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Be the first to suggest a feature</CardTitle>
                  <CardDescription>
                    Submit a feature request and share it with your team to
                    gather support.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              sortedFeatures.map((feature) => (
                <Card key={feature.id} className="h-full">
                  <CardHeader>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <CardDescription className="text-sm text-muted-foreground">
                      {feature.description}
                    </CardDescription>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground text-base">
                        {feature.voteCount.toLocaleString('en-US')}
                      </span>
                      <span>people want this</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      variant={feature.hasVoted ? 'default' : 'secondary'}
                      disabled={activeVoteId === feature.id}
                      onClick={() => void handleVote(feature.id)}
                      className={cn(
                        'w-full max-w-xs justify-center gap-2 font-normal transition-all',
                        feature.hasVoted ? 'shadow-md' : 'shadow-sm',
                      )}
                    >
                      {activeVoteId === feature.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      I want this
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </section>

          <aside>
            <Card>
              <CardHeader>
                <CardTitle>Request a feature</CardTitle>
                <CardDescription>
                  Share what would make Tailz even better for you and your team.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) => void handleSubmit(event)}
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="feature-title">Feature title</Label>
                    <Input
                      id="feature-title"
                      placeholder="Give your idea a short, descriptive title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      minLength={3}
                      maxLength={120}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="feature-description">
                      Why do you want this?
                    </Label>
                    <textarea
                      id="feature-description"
                      placeholder="Explain the problem this feature would solve or why it excites you."
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      required
                      minLength={10}
                      maxLength={2000}
                      className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Share your idea
                  </Button>
                </form>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}
