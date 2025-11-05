import { AppProvider } from '@/components/providers/app-provider'
import { SetupApp } from './setup-app'

export function SetupAppWrapper() {
  return (
    <AppProvider>
      <SetupApp />
    </AppProvider>
  )
}

