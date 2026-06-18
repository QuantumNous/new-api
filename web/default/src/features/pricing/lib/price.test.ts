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
import type { PricingModel } from '../types'
import { getEffectiveGroupRatio } from './price'

// getEffectiveGroupRatio 是 ① 修复里「所见单价 = 表达式价 × 该分组有效倍率」的倍率来源,
// 与后端 pkg/billingexpr/settle.go 的 quotaBeforeGroup × GroupRatio 对齐。优先级:
// group_pricing[group] 为数字(legacy) > group_pricing[group].ratio > 全局 group_ratio[group] > 1。

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

// legacy:group_pricing 直接是数字时,该数字就是分组倍率(优先于全局)。
test('getEffectiveGroupRatio legacy 数字 group_pricing 优先', () => {
  const model = baseModel({ group_pricing: { vip: 3 } })
  assert.equal(getEffectiveGroupRatio(model, 'vip', { vip: 9 }), 3)
})

// 对象形态显式设置 ratio 时,取该 ratio(优先于全局 group_ratio)。
test('getEffectiveGroupRatio 对象 ratio 覆盖全局倍率', () => {
  const model = baseModel({ group_pricing: { vip: { ratio: 5 } } })
  assert.equal(getEffectiveGroupRatio(model, 'vip', { vip: 9 }), 5)
})

// 分组覆盖里没有 ratio(例如只覆盖了 billing_expr)时,回退到全局 group_ratio。
test('getEffectiveGroupRatio 覆盖缺 ratio 时回退全局倍率', () => {
  const model = baseModel({
    group_pricing: { vip: { billing_expr: 'v1:tier("default", p*1 c*1)' } },
  })
  assert.equal(getEffectiveGroupRatio(model, 'vip', { vip: 7 }), 7)
})

// 既无分组覆盖、也无全局倍率时,默认 1(绝不返回 0 或 NaN,避免显示价归零)。
test('getEffectiveGroupRatio 无任何配置时默认 1', () => {
  const model = baseModel()
  assert.equal(getEffectiveGroupRatio(model, 'vip', {}), 1)
})

// model 为 undefined 时也要安全回退到全局倍率,不抛错。
test('getEffectiveGroupRatio model 缺失时仍读全局倍率', () => {
  assert.equal(getEffectiveGroupRatio(undefined, 'vip', { vip: 4 }), 4)
})

// 非有限值(NaN/Infinity)的覆盖被忽略,回退到下一优先级。
test('getEffectiveGroupRatio 忽略非有限覆盖值', () => {
  const model = baseModel({ group_pricing: { vip: { ratio: Number.NaN } } })
  assert.equal(getEffectiveGroupRatio(model, 'vip', { vip: 2 }), 2)
})
