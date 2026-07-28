import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChartPalette } from '@/charts/palette'
import type { OptionBuilder } from '@/charts/useEChart'
import ModelDistributionCard from '@/components/console/dashboard/ModelDistributionCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { ModelShare } from '@/composables/useDashboard'

/**
 * ECharts needs a real canvas, which jsdom does not provide. Capturing the
 * option builder instead is also the sharper test: what matters here is the
 * top-N fold, not that ECharts can draw a ring.
 */
const captured: { build?: OptionBuilder; dispatch: ReturnType<typeof vi.fn> } =
  {
    dispatch: vi.fn(),
  }

vi.mock('@/charts/useEChart', () => ({
  useEChart: (_el: unknown, build: OptionBuilder) => {
    captured.build = build
    return { refresh: vi.fn(), dispatch: captured.dispatch }
  },
}))

const palette = {
  series: ['#1', '#2', '#3', '#4', '#5', '#6'],
  surfaceSolid: '#fff',
  borderSubtle: '#eee',
  textPrimary: '#000',
  textTertiary: '#888',
} as unknown as ChartPalette

interface Slice {
  name: string
  value: number
}

function slices(): Slice[] {
  const option = captured.build!(palette) as {
    series: [{ data: Slice[] }]
  }
  return option.series[0].data
}

function model(name: string, quota: number): ModelShare {
  return {
    model: name,
    ratio: 0,
    quota,
    standard_quota: Math.round(quota * 1.25),
    requests: 100,
    tokens: quota * 600,
  }
}

/** Descending spend, so index order and rank order already agree. */
function models(count: number): ModelShare[] {
  return Array.from({ length: count }, (_, i) =>
    model(`model-${i + 1}`, (count - i) * 1_000)
  )
}

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

beforeEach(() => {
  captured.build = undefined
  captured.dispatch = vi.fn()
})

function render(items: ModelShare[]) {
  return mount(ModelDistributionCard, {
    props: { items },
    global: { plugins: [i18n] },
  })
}

describe('ModelDistributionCard', () => {
  it('plots every model when there are ten or fewer', () => {
    render(models(10))

    expect(slices()).toHaveLength(10)
    expect(slices().some((s) => s.name.includes('other'))).toBe(false)
  })

  it('folds everything past the tenth into one aggregate slice', () => {
    render(models(15))

    const data = slices()
    expect(data).toHaveLength(11)
    expect(data[10]!.name).toBe('5 other models')
  })

  it('keeps the aggregate equal to the sum of what it replaced', () => {
    const items = models(15)
    render(items)

    const tail = [...items].sort((a, b) => b.quota - a.quota).slice(10)
    expect(slices()[10]!.value).toBe(tail.reduce((s, m) => s + m.quota, 0))
  })

  it('ranks slices by spend regardless of input order', () => {
    render([model('small', 100), model('big', 9_000), model('mid', 4_000)])

    expect(slices().map((s) => s.name)).toEqual(['big', 'mid', 'small'])
  })

  it('lists every model even though the chart folds the tail', () => {
    const wrapper = render(models(15))

    expect(wrapper.findAll('tbody tr')).toHaveLength(15)
  })

  it('gives folded rows a neutral swatch instead of a slice colour', () => {
    const wrapper = render(models(15))
    const swatchOf = (row: number) =>
      wrapper.findAll('tbody tr')[row]!.find('span > span').attributes('style')

    expect(swatchOf(0)).toContain('var(--accent)')
    // Row 11 onward has no slice of its own, so it must not borrow a hue.
    expect(swatchOf(10)).toContain('var(--text-tertiary)')
    expect(swatchOf(14)).toContain('var(--text-tertiary)')
  })

  it('points folded rows at the aggregate slice on hover', async () => {
    const wrapper = render(models(15))
    const rows = wrapper.findAll('tbody tr')

    await rows[3]!.trigger('mouseenter')
    expect(captured.dispatch).toHaveBeenLastCalledWith({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: 3,
    })

    // Rows 11-15 all share the single aggregate slice at index 10.
    await rows[13]!.trigger('mouseenter')
    expect(captured.dispatch).toHaveBeenLastCalledWith({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: 10,
    })
  })

  it('downplays the slice a row pointed at when the cursor leaves', async () => {
    const wrapper = render(models(15))

    await wrapper.findAll('tbody tr')[12]!.trigger('mouseleave')
    expect(captured.dispatch).toHaveBeenLastCalledWith({
      type: 'downplay',
      seriesIndex: 0,
      dataIndex: 10,
    })
  })
})
