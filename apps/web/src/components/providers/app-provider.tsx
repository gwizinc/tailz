import { ThemeProvider } from 'next-themes'

import { Toaster } from '../ui/sonner'

import { AuthProvider } from './auth-provider'
import { TrpcProvider } from './trpc-provider'

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TrpcProvider>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </TrpcProvider>
    </ThemeProvider>
  )
}
