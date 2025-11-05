import { AppLayout } from '../layout'
import { AppProvider } from '../providers/app-provider'

export function ExampleApp() {
  return (
    <AppProvider>
      <AppLayout>
        <div className="flex flex-1 overflow-hidden">
          <h1>Hello World</h1>
        </div>
      </AppLayout>
    </AppProvider>
  )
}
