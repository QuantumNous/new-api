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
/**
 * 首页模型价格对比配置
 * 您可以在这里自定义显示的模型、价格和公告信息
 */

export interface ModelPricingConfig {
  name: string
  cacheHit?: string
  officialInputPrice?: number
  officialOutputPrice?: number
}

/**
 * 货币单位配置
 * currency: 'USD' | 'CNY' - 美元或人民币
 * symbol: 显示符号，如 '$' 或 '¥'
 */
export const pricingCurrencyConfig = {
  // 货币类型：'USD' 或 'CNY'
  currency: 'USD' as 'USD' | 'CNY',
  // 显示符号
  symbol: '$',
}

/**
 * 表头标题配置
 * 可自定义各列的显示标题
 */
export const pricingHeaderConfig = {
  model: 'Model',
  input: 'Minimum Input (1M)',
  output: 'Minimum Output (1M)',
  official: 'Official Input / Output (1M)',
  discount: 'Discount',
}

export const featuredModelNames = [
  'claude-fable-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-sonnet-5',
  'gpt-5.6-sol',
  'gpt-5.5',
] as const

/**
 * 配置首页需要展示的模型
 * - name: 模型名称
 * - cacheHit: 缓存命中展示文本
 *
 * 价格从后台 /api/pricing 的模型倍率配置读取，不在前端写死。
 */
export const modelPricingConfig: ModelPricingConfig[] = [
  {
    name: 'claude-fable-5',
    cacheHit: '>93%',
  },
  {
    name: 'claude-opus-5',
    cacheHit: '>93%',
    officialInputPrice: 5,
    officialOutputPrice: 25,
  },
  {
    name: 'claude-opus-4-8',
    cacheHit: '>93%',
  },
  {
    name: 'claude-sonnet-5',
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.6-sol',
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.5',
    cacheHit: '>93%',
  },
  {
    name: 'claude-opus-4-7',
    cacheHit: '>93%',
  },
  {
    name: 'claude-opus-4-6',
    cacheHit: '>93%',
  },
  {
    name: 'claude-sonnet-4-6',
    cacheHit: '>93%',
  },
  {
    name: 'claude-haiku-4-5',
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.6-terra',
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.6-luna',
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.4',
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.3-codex',
    cacheHit: '>93%',
  },
]
