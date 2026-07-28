import { isMockApi } from '@/api/client'

function waitForMockLatency(
  signal: AbortSignal,
  latency: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('The probe was aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, latency)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('The probe was aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function runEndpointProbe(
  id: string,
  url: string,
  signal: AbortSignal,
  mock = isMockApi
): Promise<number> {
  if (mock) {
    const latency = 24 + ((id.length * 13) % 48)
    await waitForMockLatency(signal, latency)
    return latency
  }

  const startedAt = performance.now()
  await fetch(url, {
    method: 'HEAD',
    mode: 'no-cors',
    cache: 'no-store',
    signal,
  })
  return Math.max(1, Math.round(performance.now() - startedAt))
}
