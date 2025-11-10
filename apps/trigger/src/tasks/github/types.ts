export interface WebhookHandlerContext {
  deliveryId: string
  rawPayload: unknown
}

export type WebhookHandler = (context: WebhookHandlerContext) => Promise<void>

