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

export function resolveGrokCreateTypeSwitch(input: {
  isEditing: boolean
  currentType: number
  nextType: number
  formKey?: string
}): {
  key: string
  closeTransientState: boolean
} {
  const closeTransientState =
    !input.isEditing && input.currentType === 113 && input.nextType !== 113

  return {
    key: closeTransientState ? '' : (input.formKey ?? ''),
    closeTransientState,
  }
}

export type GrokOAuthAuthorizedKeyDecision =
  | { action: 'store'; key: string }
  | { action: 'invalidate'; channelId: number }
  | { action: 'ignore' }

export function resolveGrokOAuthAuthorizedKeyDecision(input: {
  channelId?: number | null
  currentType: number
  key?: string
}): GrokOAuthAuthorizedKeyDecision {
  if (input.channelId !== undefined && input.channelId !== null) {
    return { action: 'invalidate', channelId: input.channelId }
  }
  if (input.currentType !== 113) return { action: 'ignore' }
  if (!input.key?.trim()) return { action: 'ignore' }
  return { action: 'store', key: input.key }
}
