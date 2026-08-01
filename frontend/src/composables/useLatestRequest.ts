import { onScopeDispose } from 'vue'

export type LatestRunResult<T> =
  | { stale: boolean; ok: true; value: T }
  | { stale: boolean; ok: false; error: unknown }

/**
 * Serializes overlapping loads of one resource. Starting a new run aborts the
 * previous request's signal, and a superseded (or scope-disposed) run resolves
 * with `stale: true` so callers never apply out-of-date results — the shared
 * replacement for the hand-rolled controller + sequence-counter pattern.
 */
export function useLatestRequest() {
  let controller: AbortController | null = null
  let sequence = 0

  function cancel(): void {
    sequence += 1
    controller?.abort()
    controller = null
  }

  onScopeDispose(cancel)

  async function run<T>(
    task: (signal: AbortSignal) => Promise<T>
  ): Promise<LatestRunResult<T>> {
    controller?.abort()
    const current = new AbortController()
    controller = current
    const seq = ++sequence
    try {
      const value = await task(current.signal)
      return { stale: seq !== sequence, ok: true, value }
    } catch (error) {
      return {
        stale: seq !== sequence || current.signal.aborted,
        ok: false,
        error,
      }
    }
  }

  return { run, cancel }
}
