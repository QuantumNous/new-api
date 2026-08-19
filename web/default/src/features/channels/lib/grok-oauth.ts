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

export type GrokAuthorizationView =
  | 'authorized-unsaved'
  | 'active'
  | 'needs-reauth'
  | 'pending'

export function resolveGrokAuthorizationView(input: {
  isEditing: boolean
  formKey?: string
  serverStatus?: string
}): GrokAuthorizationView {
  if (!input.isEditing && input.formKey?.trim()) return 'authorized-unsaved'
  if (input.serverStatus === 'active') return 'active'
  if (input.serverStatus === 'needs_reauth') return 'needs-reauth'
  return 'pending'
}

export function resolveGrokCredentialTextareaValue(input: {
  channelType: number
  isEditing: boolean
  formKey?: string
}): string {
  if (input.channelType === 113 && !input.isEditing) return ''
  return input.formKey ?? ''
}
