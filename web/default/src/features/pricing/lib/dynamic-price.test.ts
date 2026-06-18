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
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from './dynamic-price'
import type { PricingModel, TokenUnit } from '../types'

// 这些测试把 ① 的「所见≠所付」修复推进到 default 的聚合视图(model-card / pricing-columns):
// 这两处通过 getDynamicPricingSummary(model, ...) 渲染分级摘要,此前**只读模型级**
// billing_expr + getDynamicDisplayGroupRatio(model)(全分组最小倍率),即便用户已选中
// 某个具体分组,也会无视该分组在 group_pricing 里覆盖的 billing_expr / 倍率,显示错误分级价。
//
// 后端结算语义(权威):最终单价 = 表达式价 × group_ratio,且分组覆盖的 billing_expr
// 优先于模型级(pkg/billingexpr/settle.go:26、relay/helper/price.go:138-147)。因此选中
// 分组时:tiers 必须来自该分组解析后的表达式,倍率必须用该分组的有效倍率。
//
// 表达式用解析器认识的 `tier("label", p*X c*Y)`,p→inputPrice、c→outputPrice。
// 模型级 p*10、vip 覆盖 p*99,以此验证按组解析取到的是覆盖值而非模型值。

const OPTS = {
  tokenUnit: 'M' as TokenUnit,
  showRechargePrice: false,
  priceRate: 1,
  usdExchangeRate: 1,
}

function baseModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    model_name: 'demo-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default', 'vip'],
    ...overrides,
  }
}

// 选中 vip 分组(覆盖了 billing_expr)时,摘要 tiers 必须来自 vip 的表达式。
test('getDynamicPricingSummary 选中分组时取分组覆盖表达式的分级', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_ratio: { default: 1, vip: 2 },
    group_pricing: {
      vip: { billing_expr: 'v1:tier("default", p*99 c*88)' },
    },
  })

  const summary = getDynamicPricingSummary(model, OPTS, 'vip')

  assert.ok(summary)
  assert.equal(summary?.tiers[0]?.inputPrice, 99)
  const inputEntry = summary?.primaryEntries.find(
    (entry) => entry.field === 'inputPrice'
  )
  assert.equal(inputEntry?.value, 99)
})

// 选中未覆盖表达式的分组时,回退到模型级表达式。
test('getDynamicPricingSummary 未覆盖分组回退模型级表达式', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_ratio: { default: 1, vip: 2 },
    group_pricing: { vip: { ratio: 2 } },
  })

  const summary = getDynamicPricingSummary(model, OPTS, 'default')

  assert.ok(summary)
  assert.equal(summary?.tiers[0]?.inputPrice, 10)
})

// 不传分组(聚合视图)时,行为与改动前一致:用模型级表达式。
test('getDynamicPricingSummary 不传分组时用模型级表达式', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_pricing: {
      vip: { billing_expr: 'v1:tier("default", p*99 c*88)' },
    },
  })

  const summary = getDynamicPricingSummary(model, OPTS)

  assert.ok(summary)
  assert.equal(summary?.tiers[0]?.inputPrice, 10)
})

// 模型级是 tiered_expr,但某分组覆盖成 per-token → 选中该组时摘要为 null,
// 调用方会改走按量价格渲染,而非展示分级表。
test('getDynamicPricingSummary 分组覆盖为非动态时返回 null', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_pricing: { vip: { billing_mode: 'per-token' } },
  })

  assert.equal(getDynamicPricingSummary(model, OPTS, 'vip'), null)
})

// 选中分组时,展示倍率必须是该分组的有效倍率;不传分组时为全动态分组最小倍率。
test('getDynamicDisplayGroupRatio 选中分组取该组倍率', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_ratio: { default: 1, vip: 2 },
  })

  assert.equal(getDynamicDisplayGroupRatio(model, 'vip'), 2)
  assert.equal(getDynamicDisplayGroupRatio(model, 'default'), 1)
  // 不传分组:全动态分组最小倍率 min(1, 2) = 1。
  assert.equal(getDynamicDisplayGroupRatio(model), 1)
})
