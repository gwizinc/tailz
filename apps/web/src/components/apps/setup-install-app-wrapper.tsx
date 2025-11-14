import { AppProvider } from '@/components/providers/app-provider'

import { SetupInstallApp } from './setup-install-app'

interface SetupInstallAppWrapperProps {
  installationId?: number
}

export function SetupInstallAppWrapper({
  installationId,
}: SetupInstallAppWrapperProps) {
  return (
    <AppProvider>
      <SetupInstallApp installationId={installationId} />
    </AppProvider>
  )
}
