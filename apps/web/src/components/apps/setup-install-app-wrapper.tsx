import { AppProvider } from '@/components/providers/app-provider'

import { SetupInstallApp } from './setup-install-app'

export function SetupInstallAppWrapper() {
  return (
    <AppProvider>
      <SetupInstallApp />
    </AppProvider>
  )
}
