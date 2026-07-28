import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import KeyFormModal from '@/components/console/keys/KeyFormModal.vue'
import i18n, { loadMessageDomain } from '@/i18n'
import type { TokenSummary } from '@/types/console'

beforeAll(async () => {
  await loadMessageDomain('console')
  i18n.global.locale.value = 'zh-CN'
})

function mountForm(editing: TokenSummary | null = null) {
  return mount(KeyFormModal, {
    attachTo: document.body,
    global: { plugins: [i18n] },
    props: { open: true, editing, models: ['gpt-4o'] },
  })
}

function advancedTrigger(): HTMLButtonElement {
  const label = i18n.global.t('keys.advancedTitle')
  const trigger = [...document.body.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(label)
  )
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error('Advanced settings trigger not found')
  }
  return trigger
}

describe('KeyFormModal', () => {
  it('defaults new tokens to auto and keeps advanced values while collapsed', async () => {
    const wrapper = mountForm()
    const typeOptions = [...document.body.querySelectorAll('[role="radio"]')]

    expect(typeOptions).toHaveLength(2)
    expect(typeOptions[0].getAttribute('aria-checked')).toBe('false')
    expect(typeOptions[1].getAttribute('aria-checked')).toBe('true')
    expect(advancedTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[name="token-custom-key"]')).toBeNull()
    expect(document.querySelector('[name="token-ip-limits"]')).toBeNull()

    advancedTrigger().click()
    await nextTick()
    const customKey = document.querySelector<HTMLInputElement>(
      '[name="token-custom-key"]'
    )!
    customKey.value = 'sk-custom-value'
    customKey.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    advancedTrigger().click()
    await nextTick()
    advancedTrigger().click()
    await nextTick()

    expect(
      document.querySelector<HTMLInputElement>('[name="token-custom-key"]')
        ?.value
    ).toBe('sk-custom-value')
    wrapper.unmount()
  })

  it('opens advanced settings when an existing token has restrictions', () => {
    const editing: TokenSummary = {
      id: 1,
      name: 'restricted',
      key_preview: 'sk-abc••••wxyz',
      type: 'auto',
      status: 1,
      used_quota: 0,
      remain_quota: 0,
      unlimited: true,
      model_limits: ['gpt-4o'],
      ip_limits: ['127.0.0.1'],
      rate_limit: 60,
      max_ratio: 2,
      load_balance: false,
      channels: [],
      expired_time: -1,
      created_time: 1,
    }
    const wrapper = mountForm(editing)

    expect(advancedTrigger().getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[name="token-custom-key"]')).toBeNull()
    expect(
      document.querySelector<HTMLTextAreaElement>('[name="token-ip-limits"]')
        ?.value
    ).toBe('127.0.0.1')
    expect(
      document.querySelector<HTMLInputElement>('[name="token-rate-limit"]')
        ?.value
    ).toBe('60')
    wrapper.unmount()
  })
})
