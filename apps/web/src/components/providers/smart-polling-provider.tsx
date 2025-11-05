import {
  SmartPollingContext,
  useSmartPollingProvider,
} from '@/hooks/use-smart-polling'

interface SmartPollingProviderProps {
  children: React.ReactNode
}

/**
 * Provider component that wraps the app with smart polling context
 */
export function SmartPollingProvider({ children }: SmartPollingProviderProps) {
  const contextValue = useSmartPollingProvider()

  return (
    <SmartPollingContext.Provider value={contextValue}>
      {children}
    </SmartPollingContext.Provider>
  )
}
