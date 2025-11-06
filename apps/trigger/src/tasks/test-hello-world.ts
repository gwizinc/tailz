import { parseEnv } from '@/helpers/env'
import { task, logger } from '@trigger.dev/sdk'

export const testHelloWorldTask = task({
  id: 'test-hello-world',
  run: async (_payload: Record<string, never>, { ctx: _ctx }) => {
    const env = parseEnv()
    logger.info('Hello World!', { pjt: env.TRIGGER_PROJECT_ID })
    await Promise.resolve()
    return { message: 'Hello World!' }
  },
})
