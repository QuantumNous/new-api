import { describe, expect, it } from 'vitest'

import {
  OPERATION_LOG_ACTION_LABEL_KEYS,
  operationLogAuthMethodKey,
  operationLogSummary,
} from '@/components/console/log-ui/operationLog'
import enConsole from '@/i18n/locales/en/console'
import zhConsole from '@/i18n/locales/zh-CN/console'
import type { OperationLogItem } from '@/types/console'

const baseLog: OperationLogItem = {
  id: 1,
  created_at: 1_700_000_000,
  kind: 'manage',
  action: 'user.update',
  params: { username: 'alice' },
  content: 'Updated user alice',
  actor: { id: 2, username: 'admin', role: 10, auth_method: 'session' },
  ip: '203.0.113.2',
  user_agent: '',
  request: null,
}

describe('operation log presentation', () => {
  it('keeps every stable action mapped in both locale bundles', () => {
    const messages = [zhConsole, enConsole] as Array<Record<string, unknown>>
    for (const key of Object.values(OPERATION_LOG_ACTION_LABEL_KEYS)) {
      for (const localeMessages of messages) {
        const value = key
          .split('.')
          .reduce<unknown>(
            (current, segment) =>
              typeof current === 'object' && current !== null
                ? (current as Record<string, unknown>)[segment]
                : undefined,
            localeMessages
          )
        expect(value, key).toEqual(expect.any(String))
      }
    }
  })

  it('maps stable actions to localized templates with their parameters', () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = []
    const text = operationLogSummary(baseLog, (key, params) => {
      calls.push([key, params])
      return `${key}:${String(params?.username)}`
    })

    expect(text).toBe('operationLogs.actions.userUpdate:alice')
    expect(calls).toEqual([
      ['operationLogs.actions.userUpdate', { username: 'alice' }],
    ])
  })

  it('falls back to English content and then the action code', () => {
    const translate = (key: string) => key
    expect(
      operationLogSummary(
        { ...baseLog, action: 'future.action', content: 'Future action' },
        translate
      )
    ).toBe('Future action')
    expect(
      operationLogSummary(
        { ...baseLog, action: 'future.action', content: '' },
        translate
      )
    ).toBe('future.action')
  })

  it('keeps known authentication methods localizable', () => {
    expect(operationLogAuthMethodKey('session')).toBe(
      'operationLogs.auth.session'
    )
    expect(operationLogAuthMethodKey('oauth:github')).toBe(
      'operationLogs.auth.oauth'
    )
    expect(operationLogAuthMethodKey('future-method')).toBeNull()
  })
})
