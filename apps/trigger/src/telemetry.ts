import * as Sentry from '@sentry/node'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SentrySpanProcessor } from '@sentry/opentelemetry'
import { trace } from '@opentelemetry/api'
import type { Tracer } from '@opentelemetry/api'

let sdk: NodeSDK | undefined
let tracer: Tracer | undefined
let initializing: Promise<Tracer | undefined> | undefined
let sentryInitialized = false

async function startSdk(): Promise<Tracer | undefined> {
  if (tracer) {
    return tracer
  }

  if (initializing) {
    return await initializing
  }

  initializing = (async () => {
    if (!sentryInitialized) {
      Sentry.init({
        defaultIntegrations: false,
        dsn: process.env.SENTRY_DSN,
        integrations: [
          Sentry.openAIIntegration({
            recordInputs: true,
            recordOutputs: true,
          }),
        ],
        ...(process.env.TRIGGER_RELEASE
          ? { release: process.env.TRIGGER_RELEASE }
          : {}),
        environment:
          process.env.NODE_ENV === 'production' ? 'production' : 'development',
      })
      sentryInitialized = true
    }

    sdk = new NodeSDK({
      spanProcessor: new SentrySpanProcessor(),
    })

    try {
      await Promise.resolve(sdk.start())
    } catch (error) {
      initializing = undefined
      console.warn('Failed to start OpenTelemetry SDK for Sentry', error)
      return undefined
    }

    tracer = trace.getTracer('kyoto-agents')
    return tracer
  })()

  const result = await initializing
  initializing = undefined
  return result
}

export async function setupTelemetry(): Promise<Tracer | undefined> {
  return await startSdk()
}

export function getTelemetryTracer(): Tracer | undefined {
  return tracer
}
