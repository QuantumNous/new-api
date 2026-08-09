export async function runEndpointProbe(
  url: string,
  signal: AbortSignal
): Promise<number> {
  const startedAt = performance.now()
  await fetch(url, {
    method: 'HEAD',
    mode: 'no-cors',
    cache: 'no-store',
    signal,
  })
  return Math.max(1, Math.round(performance.now() - startedAt))
}
