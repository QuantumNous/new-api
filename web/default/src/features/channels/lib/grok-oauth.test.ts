import { describe, expect, test } from 'bun:test'
import {
  normalizeGrokOAuthChannelID,
  resolveGrokAuthorizationView,
  resolveGrokOAuthCompletionKey,
} from './grok-oauth'

describe('Grok OAuth mode contract', () => {
  test('normalizes a new channel to unbound mode', () => {
    expect(normalizeGrokOAuthChannelID(undefined)).toBe(0)
    expect(normalizeGrokOAuthChannelID(42)).toBe(42)
  })

  test('returns the generated key only for create mode', () => {
    const response = {
      success: true,
      data: { status: 'active', key: '{"version":1}' },
    }
    expect(resolveGrokOAuthCompletionKey(undefined, response)).toBe(
      '{"version":1}'
    )
    expect(resolveGrokOAuthCompletionKey(42, response)).toBeUndefined()
  })

  test('rejects create success without a key', () => {
    expect(() =>
      resolveGrokOAuthCompletionKey(undefined, {
        success: true,
        data: { status: 'active' },
      })
    ).toThrow('Missing credential in OAuth response')
  })

  test('shows an unsaved authorization only for a new form with a key', () => {
    expect(
      resolveGrokAuthorizationView({
        isEditing: false,
        formKey: '{"version":1}',
        serverStatus: undefined,
      })
    ).toBe('authorized-unsaved')
    expect(
      resolveGrokAuthorizationView({
        isEditing: true,
        formKey: '{"version":1}',
        serverStatus: 'needs_reauth',
      })
    ).toBe('needs-reauth')
  })
})
