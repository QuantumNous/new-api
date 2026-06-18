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
  getGroupDynamicTiers,
  isGroupDynamicPricing,
  resolveGroupBillingExpr,
  resolveGroupBillingMode,
} from './group-billing'
import type { PricingModel } from '../types'

// 这些测试刻画「按分组解析计费表达式 / 计费方式」的纯逻辑(custom feature #4/#5),
// 修复 default 主题「所见≠所付」缺陷:此前 default 的动态计费函数只读模型级
// model.billing_expr,完全忽略某个分组在 group_pricing 里覆盖的 billing_expr /
// billing_mode,导致「按分组定价」表格对被覆盖分组显示错误的分级价。
//
// classic 主题早有 resolveGroupBillingExpr(record, group) 做按组解析,这里为 default
// 补上对称实现。模块为纯函数(仅依赖 billing-expr + constants + 类型),可被 node --test
// 直接运行,无需 @/ 别名解析。
//
// 分级表达式用 billing-expr 解析器认识的 `tier("label", p*X c*Y)` 形式,
// p→inputPrice、c→outputPrice。模型级用 p*10、分组覆盖用 p*99,以此验证
// 按组解析确实取到了覆盖值而非模型值。

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

// resolveGroupBillingExpr:分组覆盖了 billing_expr 时返回覆盖值。
test('resolveGroupBillingExpr 返回分组覆盖的表达式', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_pricing: {
      vip: { billing_expr: 'v1:tier("default", p*99 c*88)' },
    },
  })

  assert.equal(
    resolveGroupBillingExpr(model, 'vip'),
    'v1:tier("default", p*99 c*88)'
  )
})

// resolveGroupBillingExpr:分组未覆盖时回退到模型级表达式。
test('resolveGroupBillingExpr 无覆盖时回退模型级表达式', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_pricing: { vip: { ratio: 2 } },
  })

  assert.equal(
    resolveGroupBillingExpr(model, 'default'),
    'v1:tier("default", p*10 c*20)'
  )
})

// resolveGroupBillingMode:分组覆盖 billing_mode 优先,其次模型 tiered,其次 quota_type。
test('resolveGroupBillingMode 分组覆盖优先于模型级', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_pricing: { vip: { billing_mode: 'per-token' } },
  })

  assert.equal(resolveGroupBillingMode(model, 'vip'), 'per-token')
  assert.equal(resolveGroupBillingMode(model, 'default'), 'tiered_expr')
})

// 核心「所见≠所付」修复:某分组覆盖成不同的分级表达式时,
// 按组解析出的分级价必须来自该分组的表达式,而非模型级表达式。
test('getGroupDynamicTiers 取分组覆盖表达式的分级价', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_pricing: {
      vip: { billing_expr: 'v1:tier("default", p*99 c*88)' },
    },
  })

  const modelTiers = getGroupDynamicTiers(model, 'default')
  const vipTiers = getGroupDynamicTiers(model, 'vip')

  assert.equal(modelTiers[0]?.inputPrice, 10)
  assert.equal(vipTiers[0]?.inputPrice, 99)
  assert.equal(vipTiers[0]?.outputPrice, 88)
})

// 模型级为按量(per-token),但某分组覆盖成 tiered_expr 且配了表达式 → 该分组是动态计费。
test('isGroupDynamicPricing 识别分组覆盖为 tiered_expr', () => {
  const model = baseModel({
    quota_type: 0, // 模型级按量
    group_pricing: {
      vip: {
        billing_mode: 'tiered_expr',
        billing_expr: 'v1:tier("default", p*5 c*7)',
      },
    },
  })

  assert.equal(isGroupDynamicPricing(model, 'vip'), true)
  assert.equal(isGroupDynamicPricing(model, 'default'), false)
})

// 模型级为 tiered_expr,但某分组覆盖成 per-token → 该分组不是动态计费,不应展开分级表。
test('isGroupDynamicPricing 分组覆盖回退非动态时为 false', () => {
  const model = baseModel({
    billing_mode: 'tiered_expr',
    billing_expr: 'v1:tier("default", p*10 c*20)',
    group_pricing: { vip: { billing_mode: 'per-token' } },
  })

  assert.equal(isGroupDynamicPricing(model, 'vip'), false)
  assert.equal(getGroupDynamicTiers(model, 'vip').length, 0)
})
