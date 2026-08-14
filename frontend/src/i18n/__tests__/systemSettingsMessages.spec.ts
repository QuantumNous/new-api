import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import enConsole from '@/i18n/locales/en/console'
import zhConsole from '@/i18n/locales/zh-CN/console'

describe('system settings messages', () => {
  it('renders email examples without treating @ as linked-message syntax', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enConsole, 'zh-CN': zhConsole },
    })

    expect(i18n.global.t('systemSettings.auth.emailAliasRestrictionDesc')).toBe(
      'Reject user+alias@domain.com style addresses'
    )
    expect(
      i18n.global.t('systemSettings.operations.smtpAccountPlaceholder')
    ).toBe('noreply@example.com')

    i18n.global.locale.value = 'zh-CN'
    expect(i18n.global.t('systemSettings.auth.emailAliasRestrictionDesc')).toBe(
      '拒绝 user+alias@domain.com 格式的邮箱'
    )
    expect(
      i18n.global.t('systemSettings.operations.smtpAccountPlaceholder')
    ).toBe('noreply@example.com')
  })
})
