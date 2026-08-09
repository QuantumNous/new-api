import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import ModelCard from '@/components/console/models/ModelCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { MarketModel } from '@/types/console'

const tieredModel: MarketModel = {
  id: 1,
  name: 'gpt-4o',
  vendor: 'OpenAI',
  type: 'chat',
  billing: 'tiered',
  price: {
    input: 2.5,
    output: 10,
    cache_read: 1.25,
    tiers: [
      { label: '0-128K', input: 2.5, output: 10 },
      { label: '128K+', input: 5, output: 15 },
    ],
  },
  context: 128_000,
  tagline: '全能旗舰多模态模型，均衡的速度与质量。',
  latency: 1.78,
  tps: 62.4,
  health: 98,
  channels: ['平台', '云枢智算'],
}

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

function render(layout: 'grid' | 'list') {
  return mount(ModelCard, {
    props: { model: tieredModel, layout },
    global: { plugins: [i18n] },
  })
}

describe('ModelCard billing metadata', () => {
  it.each(['grid', 'list'] as const)(
    'shows one billing label with its tier count in %s layout',
    (layout) => {
      const wrapper = render(layout)

      expect(wrapper.findAll('[data-model-billing]')).toHaveLength(1)
      expect(wrapper.get('[data-model-billing]').text()).toBe('分档动态计费')
      expect(wrapper.get('[data-model-tier-count]').text()).toBe('2 档')
    }
  )

  it('keeps context out of the grid card while preserving price rows', () => {
    const wrapper = render('grid')

    expect(wrapper.text()).not.toContain('128K')
    expect(wrapper.text()).toContain('$2.5000')
    expect(wrapper.text()).toContain('$10.0000')
    expect(wrapper.text()).toContain('$1.2500')
    expect(wrapper.get('[data-model-divider]').classes()).toContain(
      'border-[var(--border-default)]'
    )
    expect(wrapper.get('[data-model-channels]').classes()).toEqual(
      expect.arrayContaining(['ml-auto', 'text-right'])
    )
  })

  it('hides the tier count for non-tiered pricing', () => {
    const wrapper = mount(ModelCard, {
      props: {
        model: {
          ...tieredModel,
          billing: 'token',
          price: { input: 0.15, output: 0.6 },
        },
        layout: 'grid',
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.findAll('[data-model-billing]')).toHaveLength(1)
    expect(wrapper.get('[data-model-billing]').text()).toBe('按量计费')
    expect(wrapper.find('[data-model-tier-count]').exists()).toBe(false)
  })
})
