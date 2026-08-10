import { describe, expect, it } from 'vitest'

import { ApiError } from './types'
import {
  buildSetupPayload,
  isSetupUsernameWithinLimit,
  parseSetupStatusEnvelope,
  parseSetupSubmitEnvelope,
  setupCharacterLength,
  type SetupFormValues,
} from './setup'

describe('setup API contract', () => {
  it('strictly parses setup status', () => {
    expect(
      parseSetupStatusEnvelope({
        success: true,
        data: { status: false, root_init: true, database_type: 'postgres' },
      })
    ).toEqual({ status: false, root_init: true, database_type: 'postgres' })
  })

  it('rejects malformed status envelopes', () => {
    expect(() => parseSetupStatusEnvelope({ success: true, data: {} })).toThrow(
      ApiError
    )
  })

  it('accepts the backend POST success without data', () => {
    expect(() =>
      parseSetupSubmitEnvelope({ success: true, message: 'ok' })
    ).not.toThrow()
  })

  it('preserves backend business errors', () => {
    expect(() =>
      parseSetupSubmitEnvelope({ success: false, message: '密码错误' })
    ).toThrow('密码错误')
  })

  it('maps usage modes and omits account fields for existing roots', () => {
    const values: SetupFormValues = {
      username: ' admin ',
      password: 'password123',
      confirmPassword: 'password123',
      usageMode: 'self',
    }
    expect(buildSetupPayload(values, true)).toEqual({
      SelfUseModeEnabled: true,
      DemoSiteEnabled: false,
    })
    expect(buildSetupPayload(values, false)).toEqual({
      username: 'admin',
      password: 'password123',
      confirmPassword: 'password123',
      SelfUseModeEnabled: true,
      DemoSiteEnabled: false,
    })
  })

  it.each([
    ['external', false, false],
    ['self', true, false],
    ['demo', false, true],
  ] as const)(
    'maps %s usage mode to the backend flags',
    (usageMode, selfUse, demoSite) => {
      expect(
        buildSetupPayload(
          {
            username: 'admin',
            password: 'password123',
            confirmPassword: 'password123',
            usageMode,
          },
          true
        )
      ).toEqual({
        SelfUseModeEnabled: selfUse,
        DemoSiteEnabled: demoSite,
      })
    }
  )

  it('uses Unicode character counts for setup validation', () => {
    expect(setupCharacterLength('管理员账户')).toBe(5)
    expect(isSetupUsernameWithinLimit('一二三四五六七八九十甲乙')).toBe(true)
    expect(isSetupUsernameWithinLimit('一二三四五六七八九十甲乙丙')).toBe(false)
  })
})
