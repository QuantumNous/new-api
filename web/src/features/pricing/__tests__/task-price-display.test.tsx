/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, cleanup } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { DynamicPricingBreakdown } from '../components/dynamic-pricing-breakdown'
import { ModelCard } from '../components/model-card'
import { ModelDetailsContent } from '../components/model-details'
import { getTaskPricingDisplayTiers } from '../lib/task-matrix-display'
import {
  hasSimpleTaskPricing,
  taskPriceLabel,
  taskEnumLabel,
  taskPricingConditions,
} from '../lib/task-price-display'
import type { PricingModel, BillingUsageSchema } from '../types'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))

it('shows an explicit free request price alongside token prices with distinct units', () => {
  render(
    <DynamicPricingBreakdown
      billingExpr='len < 1000 ? tier("free", fixed(0)) : tier("tokens", p * 2 + c * 8)'
      matchedTierLabel='free'
    />
  )
  expect(screen.getAllByText('$0/request').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Input / 1M token').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Price per request').length).toBeGreaterThan(0)
})

it('renders weekday and hour conditions as time windows instead of expression source', () => {
  const condition =
    'weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18))'
  render(
    <DynamicPricingBreakdown
      billingExpr={`${condition} ? tier("peak", p * 3 + c * 9 + cr * 0.1) : tier("off_peak", p * 1.5 + c * 4.5 + cr * 0.05)`}
    />
  )
  expect(
    screen.getAllByText('Mon–Fri 09:00–12:00 or 14:00–18:00 (Asia/Shanghai)')
      .length
  ).toBeGreaterThan(0)
  expect(
    screen.getAllByText(
      'Outside these times: Mon–Fri 09:00–12:00 or 14:00–18:00 (Asia/Shanghai)'
    ).length
  ).toBeGreaterThan(0)
  expect(screen.queryByText(/weekday\(/)).not.toBeInTheDocument()
})

const model: PricingModel = {
  id: 1,
  model_name: 'incho_music',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 1,
  enable_groups: ['default'],
  billing_mode: 'tiered_expr',
  billing_expr: 'tier("music", u("clips") * 0.22)',
  billing_usage_schema: {
    clips: {
      type: 'number',
      unit: 'count',
      description: { en: 'Song generation unit price', zh: '生成歌曲单价' },
    },
    action: {
      enum: ['music'],
      enumLabels: { music: { en: 'Generate songs', zh: '生成歌曲' } },
      description: { en: 'Generate songs', zh: '生成歌曲' },
    },
  },
}
const clients: QueryClient[] = []
afterEach(async () => {
  cleanup()
  clients.forEach((client) => client.clear())
  clients.length = 0
  vi.restoreAllMocks()
  await i18next.changeLanguage('en')
})

it('shows one standard task price and a localized group price without duplicate tiers', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { groups: [] } } })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <ModelDetailsContent
        model={model}
        groupRatio={{ default: 2 }}
        usableGroup={{ default: { desc: '', ratio: 2 } }}
        endpointMap={{}}
        autoGroups={[]}
        priceRate={1}
        usdExchangeRate={7}
        tokenUnit='M'
      />
    </QueryClientProvider>
  )
  expect(
    screen.getAllByText('Song generation unit price', { exact: false })
  ).toHaveLength(2)
  expect(screen.queryByText('Tiered price table')).not.toBeInTheDocument()
  expect(screen.queryByText('Dynamic Pricing')).not.toBeInTheDocument()
  expect(screen.queryByText('music')).not.toBeInTheDocument()
  expect(screen.getByText('$0.22')).toBeVisible()
  expect(screen.getByText('$0.44')).toBeVisible()
  await act(() => i18next.changeLanguage('zhCN'))
  expect(screen.getAllByText('生成歌曲单价', { exact: false })).toHaveLength(2)
  await act(() => i18next.changeLanguage('fr'))
  expect(
    screen.getAllByText('Song generation unit price', { exact: false })
  ).toHaveLength(2)
})

it('labels even a single task price on model cards', async () => {
  render(<ModelCard model={model} onClick={() => {}} />)
  expect(screen.getByText('Song generation unit price')).toBeVisible()
  await act(() => i18next.changeLanguage('zhCN'))
  expect(screen.getByText('生成歌曲单价')).toBeVisible()
})

it('preserves condition tables, boolean states and additional charges', () => {
  render(
    <DynamicPricingBreakdown
      billingExpr='u("audio") == true ? tier("audio", 1 + u("seconds") * 0.8) : tier("silent", u("seconds") * 0.4)'
      usageSchema={{
        seconds: {
          type: 'number',
          unit: 'second',
          description: { en: 'Video generation unit price' },
        },
        audio: {
          type: 'boolean',
          description: { en: 'Whether audio is generated' },
        },
      }}
    />
  )
  expect(
    screen.getByRole('columnheader', { name: 'Applicable conditions' })
  ).toBeVisible()
  expect(screen.queryByText('Pricing conditions')).not.toBeInTheDocument()
  expect(
    screen.getAllByText('Whether audio is generated: Yes').length
  ).toBeGreaterThan(0)
  expect(
    screen.getAllByText('Whether audio is generated: No').length
  ).toBeGreaterThan(0)
  expect(screen.getAllByText('Additional charge').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Video generation unit price')[0]).toHaveClass(
    'whitespace-normal',
    'break-words'
  )
})

it('keeps rules and custom expressions out of the simple price layout', () => {
  expect(hasSimpleTaskPricing(model)).toBe(true)
  expect(
    hasSimpleTaskPricing({
      ...model,
      billing_expr: `${model.billing_expr}|||when(header("x-fast") == "true") * 2`,
    })
  ).toBe(false)
  expect(
    hasSimpleTaskPricing({
      ...model,
      billing_expr: 'max(u("clips"), 2) * 0.22',
    })
  ).toBe(false)
  expect(taskPriceLabel(undefined, 'clips', 'fr')).toBe('clips')
  expect(
    taskPriceLabel({ en: 'Song price', zh: '歌曲单价' }, 'clips', 'zh-TW')
  ).toBe('歌曲单价')
  expect(
    taskPriceLabel({ en: 'Song price', zh: '歌曲单价' }, 'clips', 'ja')
  ).toBe('Song price')
})

const videoSchema: BillingUsageSchema = {
  tokens: {
    type: 'number',
    unit: 'token',
    description: { en: 'Billing token unit price', zh: '计费 Token 单价' },
  },
  resolution: {
    enum: ['480p', '720p', '1080p'],
    description: { en: 'Output resolution', zh: '输出分辨率' },
  },
  video_input: {
    enum: ['none', 'video'],
    description: { en: 'Reference video input', zh: '参考视频输入' },
    enumLabels: {
      none: { en: 'No reference video', zh: '无参考视频' },
      video: { en: 'With reference video', zh: '有参考视频' },
    },
  },
}
const videoExpression =
  'u("video_input") == "none" ? tier("none", u("tokens") * 10 / 1000000) : tier("video", u("tokens") * 6 / 1000000)'

it('uses plugin option labels and infers a unique fallback without expanding unrelated fields', async () => {
  render(
    <DynamicPricingBreakdown
      billingExpr={videoExpression}
      usageSchema={videoSchema}
    />
  )
  expect(screen.getAllByText('No reference video')).toHaveLength(2)
  expect(screen.getAllByText('With reference video')).toHaveLength(2)
  expect(screen.queryByText('Other cases')).not.toBeInTheDocument()
  expect(screen.queryByText('Pricing conditions')).not.toBeInTheDocument()
  expect(screen.queryByText('480p')).not.toBeInTheDocument()
  await act(() => i18next.changeLanguage('zhCN'))
  expect(screen.getAllByText('无参考视频')).toHaveLength(2)
  expect(screen.getAllByText('有参考视频')).toHaveLength(2)
  await act(() => i18next.changeLanguage('ja'))
  expect(screen.getAllByText('With reference video')).toHaveLength(2)
})

it('names ambiguous fallback rows other cases and keeps unmatched enum values readable', () => {
  const schema = {
    ...videoSchema,
    video_input: {
      ...videoSchema.video_input,
      enum: ['none', 'video', 'mixed'],
    },
  }
  render(
    <DynamicPricingBreakdown
      billingExpr={videoExpression}
      usageSchema={schema}
    />
  )
  expect(screen.getAllByText('Other cases')).toHaveLength(2)
  expect(taskEnumLabel(schema.video_input, 'mixed', 'zhCN')).toBe('mixed')
  expect(
    taskPricingConditions(
      [{ field: 'video_input', value: 'mixed' }],
      schema,
      'en',
      (key) => key
    )
  ).toBe('Reference video input: mixed')
  expect(
    taskEnumLabel(
      { enum: ['x'], enumLabels: { x: { en: 'English', zh: '中文' } } },
      'x',
      'fr'
    )
  ).toBe('English')
})

it('preserves all conditions and leaves multiple possible fallback combinations unspecified', () => {
  const tiers = getTaskPricingDisplayTiers(
    'u("resolution") == "720p" && u("video_input") == "none" ? tier("one", u("tokens") * 10 / 1000000) : tier("rest", u("tokens") * 6 / 1000000)',
    videoSchema
  )
  expect(
    taskPricingConditions(tiers[0].conditions, videoSchema, 'en', (key) => key)
  ).toBe('Output resolution: 720p · No reference video')
  expect(tiers[1].conditions).toEqual([])
})

it('uses the same recharge conversion and token unit in task condition prices', () => {
  render(
    <DynamicPricingBreakdown
      billingExpr={videoExpression}
      usageSchema={videoSchema}
      taskPriceOptions={{
        showRechargePrice: true,
        priceRate: 1,
        usdExchangeRate: 2,
      }}
    />
  )
  expect(screen.getAllByText('$5/1M token')).toHaveLength(2)
  expect(screen.getAllByText('$3/1M token')).toHaveLength(2)
})
