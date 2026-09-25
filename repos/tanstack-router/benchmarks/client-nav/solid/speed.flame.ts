import { window } from '../jsdom.ts'
import { setup } from './setup.ts'

const DURATION_MS = 10_000

const test = setup()

try {
  await test.before()

  const startedAt = performance.now()
  while (performance.now() - startedAt < DURATION_MS) {
    await test.tick()
  }
} finally {
  test.after()
  window.close()
}
