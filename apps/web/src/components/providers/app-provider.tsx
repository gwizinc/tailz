import { Toaster } from '../ui/sonner'

import { AuthProvider } from './auth-provider'
import { TrpcProvider } from './trpc-provider'

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <TrpcProvider>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </TrpcProvider>
  )
}
