import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { GITHUB_APP_SLUG } from 'astro:env/client'

export function SetupInstallApp() {
  const installUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`
  return (
    <AppLayout>
      <div className="h-full w-full px-4 py-10 md:py-16 flex items-center justify-center">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">
              Install our GitHub App
            </CardTitle>
            <CardDescription>
              Install the app on your organization to grant access to your
              repositories. You can choose repositories during installation and
              later enable them in Kyoto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="mt-4">
              <a href={installUrl}>Install on GitHub</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
