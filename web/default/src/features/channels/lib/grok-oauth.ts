import type { GrokAuthStatusResponse } from '../api'

export function normalizeGrokOAuthChannelID(channelId?: number): number {
  return channelId ?? 0
}

export function resolveGrokOAuthCompletionKey(
  channelId: number | undefined,
  response: GrokAuthStatusResponse
): string | undefined {
  if (channelId !== undefined && channelId > 0) return undefined
  const key = response.data?.key?.trim()
  if (!key) throw new Error('Missing credential in OAuth response')
  return key
}
