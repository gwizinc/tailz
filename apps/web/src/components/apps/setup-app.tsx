import { navigate } from 'astro:transitions/client'
import { useEffect, useState } from 'react'
import { useTRPCClient } from '@/client/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function SetupApp() {
  const trpc = useTRPCClient()
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<Array<{ slug: string; name: string }>>([])
  const [repos, setRepos] = useState<Array<{ id: string; name: string; defaultBranch: string | null; enabled: boolean }>>([])
  const [saving, setSaving] = useState(false)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const data = await trpc.org.listInstalled.query()
      if (!mounted) return
      setOrgs(data.orgs)
    })()
    return () => {
      mounted = false
    }
  }, [trpc])

  useEffect(() => {
    if (!selectedOrg) return
    let mounted = true
    setLoadingRepos(true)
    ;(async () => {
      const data = await trpc.repo.listByOrg.query({ orgSlug: selectedOrg })
      if (!mounted) return
      setRepos(data.repos as Array<{ id: string; name: string; defaultBranch: string | null; enabled: boolean }>)
      setSelectedRepos({})
      setLoadingRepos(false)
    })()
    return () => {
      mounted = false
    }
  }, [trpc, selectedOrg])

  const onToggle = (name: string) => {
    setSelectedRepos((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const onSave = async () => {
    if (!selectedOrg) return
    const names = Object.entries(selectedRepos)
      .filter(([, v]) => v)
      .map(([k]) => k)
    setSaving(true)
    try {
      await trpc.repo.setEnabled.mutate({ orgSlug: selectedOrg, repoNames: names })
      // Redirect to home after successful save
      await navigate('/')
    } catch (error) {
      console.error('Failed to save repository selection:', error)
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Select repositories to enable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Organization</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={selectedOrg ?? ''}
                onChange={(e) => {
                  setSelectedOrg(e.target.value || null)
                  setSelectedRepos({})
                }}
              >
                <option value="">Select organization…</option>
                {orgs.map((o: { slug: string; name: string }) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <Separator />

            {selectedOrg && !loadingRepos && (
              <div className="space-y-2">
                {repos.length === 0 && <div className="text-sm text-muted-foreground">No repositories found.</div>}
                {repos.map((r: { id: string; name: string; defaultBranch: string | null; enabled: boolean }) => (
                  <label key={r.id} className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedRepos[r.name] ?? r.enabled}
                      onChange={() => onToggle(r.name)}
                    />
                    <span className="text-sm">{r.name}</span>
                  </label>
                ))}
                <div className="pt-2">
                  <Button onClick={onSave} disabled={saving}>
                    Save selection
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


