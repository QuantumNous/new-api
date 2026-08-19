import { describe, expect, test } from 'bun:test'
import {
  normalizeGrokOAuthChannelID,
  resolveGrokAuthorizationView,
  resolveGrokCredentialTextareaValue,
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

  test('masks create-mode Grok credentials from the generic key field value', () => {
    const credential =
      '{"version":1,"type":"grok_subscription","access_token":"at"}'

    expect(
      resolveGrokCredentialTextareaValue({
        channelType: 113,
        isEditing: false,
        formKey: credential,
      })
    ).toBe('')
    expect(
      resolveGrokCredentialTextareaValue({
        channelType: 113,
        isEditing: true,
        formKey: credential,
      })
    ).toBe(credential)
    expect(
      resolveGrokCredentialTextareaValue({
        channelType: 1,
        isEditing: false,
        formKey: credential,
      })
    ).toBe(credential)
  })
})
