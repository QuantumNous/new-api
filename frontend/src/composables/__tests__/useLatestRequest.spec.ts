import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'

import { useLatestRequest } from '@/composables/useLatestRequest'

function createInScope() {
  const scope = effectScope()
  const request = scope.run(() => useLatestRequest())
  if (!request) throw new Error('expected composable instance')
  return { scope, run: request.run }
}

describe('useLatestRequest', () => {
  it('marks superseded runs stale and aborts their signal', async () => {
    const { scope, run } = createInScope()

    let resolveFirst: (value: string) => void = () => undefined
    const signals: AbortSignal[] = []
    const first = run((signal) => {
      signals.push(signal)
      return new Promise<string>((resolve) => {
        resolveFirst = resolve
      })
    })

    const second = await run(async () => 'second')
    expect(second).toEqual({ stale: false, ok: true, value: 'second' })
    expect(signals[0].aborted).toBe(true)

    resolveFirst('first')
    const firstResult = await first
    expect(firstResult.ok).toBe(true)
    expect(firstResult.stale).toBe(true)

    scope.stop()
  })

  it('reports failures as non-stale errors for the active run', async () => {
    const { scope, run } = createInScope()

    const failure = new Error('boom')
    const result = await run(async () => {
      throw failure
    })
    expect(result).toEqual({ stale: false, ok: false, error: failure })

    scope.stop()
  })

  it('aborts the in-flight request when the owning scope is disposed', async () => {
    const { scope, run } = createInScope()

    const signals: AbortSignal[] = []
    void run((signal) => {
      signals.push(signal)
      return new Promise(() => {})
    })

    scope.stop()
    expect(signals[0].aborted).toBe(true)
  })
})
