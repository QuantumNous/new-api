import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import AuthRelayFlow from '@/components/auth/AuthRelayFlow.vue'
import { MODEL_NODES } from '@/constants/home/models'
import { useTheme } from '@/composables/useTheme'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

/** 支线终点 x（组件内 FAN_W = 88） */
const FAN_W = 88

beforeAll(async () => {
  await loadMessageDomain('auth')
  setLocale('en')
})

afterAll(() => {
  useTheme().setThemePreference('auto')
})

function mountFlow() {
  return mount(AuthRelayFlow, {
    global: { plugins: [i18n, createPinia()] },
  })
}

describe('AuthRelayFlow', () => {
  it('names every upstream from the shared model list', () => {
    const wrapper = mountFlow()

    const names = wrapper.findAll('.relay__name').map((n) => n.text())

    // v2：上游从 4 条减为 3 条
    expect(names).toEqual(MODEL_NODES.slice(0, 3).map((m) => m.name))
  })

  it('lands every branch on the upstream column', () => {
    const wrapper = mountFlow()

    const endpoints = wrapper
      .findAll('.relay__packet--out')
      .map((p) => p.attributes('d') ?? '')
      .map((d) => d.trim().split(/\s+/).slice(-2).map(Number))

    // v2：3 条折线道岔，ROW_Y = [15, 45, 75]
    expect(endpoints).toEqual([
      [FAN_W, 15],
      [FAN_W, 45],
      [FAN_W, 75],
    ])
  })

  it('pairs a request and a response packet with each branch', () => {
    const wrapper = mountFlow()

    // v2：3 条上游
    expect(wrapper.findAll('.relay__packet--out')).toHaveLength(3)
    expect(wrapper.findAll('.relay__packet--back')).toHaveLength(3)
  })

  it('uses stable straight-line paths in both light and dark themes', async () => {
    const theme = useTheme()

    theme.setThemePreference('light')
    const byDay = mountFlow()
      .findAll('.relay__packet--out')
      .map((p) => p.attributes('d'))

    theme.setThemePreference('dark')
    const byNight = mountFlow()
      .findAll('.relay__packet--out')
      .map((p) => p.attributes('d'))

    // v2：折线道岔取代贝塞尔手绘抖动，路径不随主题变化——
    // 双主题只换令牌颜色，几何保持一致。
    expect(byNight).toEqual(byDay)
    expect(byDay).toHaveLength(3)
  })
})
