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
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, test, vi } from 'vitest'

import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'
import { evaluateBillingExpression } from '@/features/pricing/lib/billing-expression/runtime'

import { TieredPricingEditor } from '../tiered-pricing-editor'

const expression =
  'weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18))\n  ? tier("peak", p * 3 + cr * 0.10 + c * 9)\n  : tier("off_peak", p * 1.5 + cr * 0.05 + c * 4.5)'

describe('visual time billing editor', () => {
  test.each([
    ['simple tiers', 'tier("base", p * 2 + c * 8)', '2'],
    ['condition tree', expression, '3'],
  ])(
    'switches %s between token and request prices while preserving drafts',
    async (_name, source, tokenPrice) => {
      const onBillingExprChange = vi.fn()
      const onRequestRuleExprChange = vi.fn()
      render(
        <TieredPricingEditor
          billingExpr={source}
          requestRuleExpr='(param("fast") == true ? 2 : 1)'
          onBillingExprChange={onBillingExprChange}
          onRequestRuleExprChange={onRequestRuleExprChange}
        />
      )
      const user = userEvent.setup()
      await user.click(
        screen.getAllByRole('combobox', { name: 'Tier billing mode' })[0]
      )
      await user.click(screen.getByRole('option', { name: 'Per-call' }))
      expect(
        screen.getByRole('textbox', { name: 'Price per request' })
      ).toHaveValue('')
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
      expect(onBillingExprChange).not.toHaveBeenCalled()
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Price per request' }),
        { target: { value: '0.02' } }
      )
      expect(onBillingExprChange.mock.lastCall?.[0]).toContain('fixed(0.02)')
      await user.click(
        screen.getAllByRole('combobox', { name: 'Tier billing mode' })[0]
      )
      await user.click(screen.getByRole('option', { name: 'Per token' }))
      expect(
        screen.getAllByRole('textbox', { name: 'Input price' })[0]
      ).toHaveValue(tokenPrice)
      await user.click(
        screen.getAllByRole('combobox', { name: 'Tier billing mode' })[0]
      )
      await user.click(screen.getByRole('option', { name: 'Per-call' }))
      expect(
        screen.getByRole('textbox', { name: 'Price per request' })
      ).toHaveValue('0.02')
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Price per request' }),
        { target: { value: '0' } }
      )
      expect(onBillingExprChange.mock.lastCall?.[0]).toContain('fixed(0)')
      expect(onRequestRuleExprChange).not.toHaveBeenCalled()
    }
  )
  test('converts request price input currency without rewriting untouched USD prices', () => {
    const onBillingExprChange = vi.fn()
    const props = {
      billingExpr: 'tier("request", fixed(0.0100))',
      requestRuleExpr: '',
      onBillingExprChange,
      onRequestRuleExprChange: vi.fn(),
    }
    const { rerender } = render(
      <TieredPricingEditor
        {...props}
        currency={{ label: 'CNY', symbol: '¥', exchangeRate: 7 }}
      />
    )
    expect(
      screen.getByRole('textbox', { name: 'Price per request' })
    ).toHaveValue('0.07')
    expect(onBillingExprChange).not.toHaveBeenCalled()
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Price per request' }),
      { target: { value: '0.14' } }
    )
    expect(onBillingExprChange).toHaveBeenLastCalledWith(
      'tier("request", fixed(0.02))'
    )
    rerender(
      <TieredPricingEditor
        {...props}
        currency={{ label: 'USD', symbol: '$', exchangeRate: 1 }}
      />
    )
    expect(
      screen.getByRole('textbox', { name: 'Price per request' })
    ).toHaveValue('0.02')
    expect(onBillingExprChange).toHaveBeenCalledTimes(1)
  })
  test('opens mixed request and token prices visually without rewriting the expression', () => {
    const onBillingExprChange = vi.fn()
    render(
      <TieredPricingEditor
        billingExpr='len <= 32000 ? tier("short", fixed(0.01)) : tier("long", p * 2 + c * 8)'
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    const tier = screen.getByRole('group', { name: 'Pricing tier short' })
    expect(
      within(tier).getByRole('textbox', { name: 'Price per request' })
    ).toHaveValue('0.01')
    expect(
      within(tier).queryByRole('textbox', { name: 'Input price' })
    ).not.toBeInTheDocument()
    expect(onBillingExprChange).not.toHaveBeenCalled()
  })
  test('opens group actions by keyboard and returns focus when dismissed', async () => {
    const onBillingExprChange = vi.fn()
    render(
      <TieredPricingEditor
        billingExpr={expression}
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    const user = userEvent.setup()
    const actions = screen.getByRole('button', {
      name: 'Condition actions 1.2',
    })
    actions.focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('menuitem', { name: 'Negate condition' })
    ).toBeVisible()
    await user.keyboard('{Escape}')
    expect(actions).toHaveFocus()
    expect(onBillingExprChange).not.toHaveBeenCalled()
  })

  test('negates the merged weekday row without changing the surrounding time group', async () => {
    const onBillingExprChange = vi.fn()
    render(
      <TieredPricingEditor
        billingExpr={expression}
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'Condition actions 1.1' })
    )
    await user.click(screen.getByRole('menuitem', { name: 'Negate condition' }))
    expect(
      screen.getByRole('group', { name: 'Condition group 1.1' })
    ).toHaveAttribute('data-condition-kind', 'not')
    const generated = onBillingExprChange.mock.lastCall?.[0]
    assert(generated)
    for (const [now, matchedTier] of [
      ['2026-09-12T10:00:00+08:00', 'peak'],
      ['2026-09-08T10:00:00+08:00', 'off_peak'],
      ['2026-09-12T13:00:00+08:00', 'off_peak'],
    ]) {
      expect(
        evaluateBillingExpression(generated, {
          now: new Date(now),
          tokens: { p: 100, c: 0, cr: 0 },
        })
      ).toMatchObject({ status: 'success', matchedTier })
    }
  })
  test('exposes the nested group hierarchy and merges weekday bounds without rewriting the source', () => {
    const onBillingExprChange = vi.fn()
    render(
      <TieredPricingEditor
        billingExpr={expression}
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    const root = screen.getByRole('group', { name: 'Condition group 1' })
    const periods = within(root).getByRole('group', {
      name: 'Condition group 1.2',
    })
    expect(root).toHaveAttribute('data-condition-kind', 'all')
    expect(periods).toHaveAttribute('data-condition-kind', 'any')
    expect(
      within(periods).getByRole('group', { name: 'Condition group 1.2.1' })
    ).toHaveAttribute('data-condition-kind', 'all')
    expect(
      within(root).getByRole('combobox', { name: 'Start weekday' })
    ).toHaveTextContent('Monday')
    expect(
      within(root).getByRole('combobox', { name: 'End weekday' })
    ).toHaveTextContent('Friday')
    expect(
      screen.queryByRole('button', { name: 'Negate condition' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('When conditions match → peak')).toBeVisible()
    expect(screen.getByText('Otherwise → off_peak')).toBeVisible()
    expect(onBillingExprChange).not.toHaveBeenCalled()
  })
  test('opens the complete time expression visually without publishing changes', () => {
    const onBillingExprChange = vi.fn()
    render(
      <TieredPricingEditor
        billingExpr={expression}
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    expect(
      within(
        screen.getByRole('group', { name: 'Pricing tier peak' })
      ).getByRole('textbox', { name: 'Input price' })
    ).toHaveValue('3')
    expect(
      within(
        screen.getByRole('group', { name: 'Pricing tier off_peak' })
      ).getByRole('textbox', { name: 'Input price' })
    ).toHaveValue('1.5')
    expect(
      screen.getAllByRole('combobox', { name: 'Condition group' }).length
    ).toBeGreaterThan(1)
    expect(onBillingExprChange).not.toHaveBeenCalled()
  })
})

test('keeps exact source and independent request rules through mode and currency changes', async () => {
  const onBillingExprChange = vi.fn()
  const onRequestRuleExprChange = vi.fn()
  const rule = '(header("x-plan") == "fast" ? 2.00 : 1)'
  const props = {
    billingExpr: expression,
    requestRuleExpr: rule,
    onBillingExprChange,
    onRequestRuleExprChange,
  }
  const view = render(<TieredPricingEditor {...props} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Editor mode' }))
  await user.click(screen.getByRole('option', { name: 'Expression editor' }))
  expect(
    screen.getByRole('textbox', { name: 'Billing expression' })
  ).toHaveValue(combineBillingExpr(expression, rule))
  await user.click(screen.getByRole('combobox', { name: 'Editor mode' }))
  await user.click(screen.getByRole('option', { name: 'Visual editor' }))
  view.rerender(
    <TieredPricingEditor
      {...props}
      currency={{ label: 'CNY', symbol: '¥', exchangeRate: 7 }}
    />
  )
  expect(
    within(screen.getByRole('group', { name: 'Pricing tier peak' })).getByRole(
      'textbox',
      { name: 'Input price' }
    )
  ).toHaveValue('21')
  expect(screen.getAllByRole('textbox', { name: 'Start' })[0]).toHaveValue('9')
  expect(onBillingExprChange).not.toHaveBeenCalled()
  expect(onRequestRuleExprChange).not.toHaveBeenCalled()
  fireEvent.change(
    within(screen.getByRole('group', { name: 'Pricing tier peak' })).getByRole(
      'textbox',
      { name: 'Input price' }
    ),
    { target: { value: '28' } }
  )
  expect(onBillingExprChange).toHaveBeenLastCalledWith(
    expression.replace('p * 3', 'p * 4')
  )
  expect(onRequestRuleExprChange).not.toHaveBeenCalled()
})

test('updates weekday, hour and timezone conditions while preserving the other branches', async () => {
  const onBillingExprChange = vi.fn()
  render(
    <TieredPricingEditor
      billingExpr={expression}
      requestRuleExpr=''
      onBillingExprChange={onBillingExprChange}
      onRequestRuleExprChange={vi.fn()}
    />
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Start weekday' }))
  await user.click(screen.getByRole('option', { name: 'Tuesday' }))
  expect(onBillingExprChange).toHaveBeenLastCalledWith(
    expression.replace('>= 1', '>= 2')
  )
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Start' })[0], {
    target: { value: '10' },
  })
  const changed = expression.replace('>= 1', '>= 2').replace('>= 9', '>= 10')
  expect(onBillingExprChange).toHaveBeenLastCalledWith(changed)
  expect(
    evaluateBillingExpression(changed, {
      now: new Date('2026-09-08T09:00:00+08:00'),
      tokens: { p: 100, c: 0, cr: 0 },
    })
  ).toMatchObject({ status: 'success', matchedTier: 'off_peak', cost: 150 })
  fireEvent.change(screen.getAllByRole('combobox', { name: 'Timezone' })[0], {
    target: { value: 'UTC' },
  })
  expect(onBillingExprChange).toHaveBeenLastCalledWith(
    changed.replaceAll('weekday("Asia/Shanghai")', 'weekday("UTC")')
  )
})

test('keeps incomplete prices and groups local, and publishes only after correction', async () => {
  const onBillingExprChange = vi.fn()
  render(
    <TieredPricingEditor
      billingExpr={expression}
      requestRuleExpr=''
      onBillingExprChange={onBillingExprChange}
      onRequestRuleExprChange={vi.fn()}
    />
  )
  const price = within(
    screen.getByRole('group', { name: 'Pricing tier peak' })
  ).getByRole('textbox', { name: 'Input price' })
  fireEvent.change(price, { target: { value: '' } })
  expect(price).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Enter a finite, non-negative price.')).toBeVisible()
  expect(onBillingExprChange).not.toHaveBeenCalled()
  fireEvent.change(price, { target: { value: '3' } })
  onBillingExprChange.mockClear()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add to group 1' }))
  await user.click(
    screen.getByRole('menuitem', { name: 'Add condition group' })
  )
  expect(
    screen.getByText('Add at least one condition to this group.')
  ).toBeVisible()
  expect(onBillingExprChange).not.toHaveBeenCalled()
  await user.click(screen.getByRole('combobox', { name: 'Editor mode' }))
  expect(
    screen.getByRole('option', { name: 'Expression editor' })
  ).toHaveAttribute('aria-disabled', 'true')
})

test('copies prices into a new branch and retains the original as its otherwise tier', async () => {
  const onBillingExprChange = vi.fn()
  render(
    <TieredPricingEditor
      billingExpr={expression}
      requestRuleExpr=''
      onBillingExprChange={onBillingExprChange}
      onRequestRuleExprChange={vi.fn()}
    />
  )
  const user = userEvent.setup()
  await user.click(
    within(screen.getByRole('group', { name: 'Pricing tier peak' })).getByRole(
      'button',
      { name: 'Add pricing branch' }
    )
  )
  expect(
    screen.getAllByRole('group', { name: 'Pricing tier peak' })
  ).toHaveLength(2)
  for (const tier of screen.getAllByRole('group', {
    name: 'Pricing tier peak',
  })) {
    expect(
      within(tier).getByRole('textbox', { name: 'Input price' })
    ).toHaveValue('3')
  }
  expect(onBillingExprChange).not.toHaveBeenCalled()
  const empty = screen
    .getAllByRole('textbox', { name: 'Condition value' })
    .find((input) => (input as HTMLInputElement).value === '')
  assert(empty)
  fireEvent.change(empty, { target: { value: '10' } })
  const lastCall = onBillingExprChange.mock.lastCall
  assert(lastCall)
  const generated = lastCall[0]
  expect(
    evaluateBillingExpression(generated, {
      now: new Date('2026-09-07T09:00:00+08:00'),
      tokens: { p: 100, c: 0, cr: 0 },
    })
  ).toMatchObject({ status: 'success', matchedTier: 'peak', cost: 300 })
  expect(
    evaluateBillingExpression(generated, {
      now: new Date('2026-09-07T11:00:00+08:00'),
      tokens: { p: 100, c: 0, cr: 0 },
    })
  ).toMatchObject({ status: 'success', matchedTier: 'peak', cost: 300 })
})

test('preserves explicit cache zero in the document form even for an otherwise legacy-shaped tier', () => {
  const source = 'tier("base", p * 3 + c * 9 + cr * 0)'
  const onBillingExprChange = vi.fn()
  render(
    <TieredPricingEditor
      billingExpr={source}
      requestRuleExpr=''
      onBillingExprChange={onBillingExprChange}
      onRequestRuleExprChange={vi.fn()}
    />
  )
  const tier = within(screen.getByRole('group', { name: 'Pricing tier base' }))
  expect(
    tier.getByRole('checkbox', { name: 'Include Cache read price' })
  ).toBeChecked()
  fireEvent.change(tier.getByRole('textbox', { name: 'Input price' }), {
    target: { value: '4' },
  })
  expect(onBillingExprChange).toHaveBeenLastCalledWith(
    source.replace('p * 3', 'p * 4')
  )
})

test.each([
  'hour("UTC") >= 9 ? max(p * 2, 100) : tier("off", p * 1)',
  'v2:tier("base", p * 3 + c * 9)',
])(
  'leaves unsupported expressions in raw mode without publishing a default price: %s',
  async (source) => {
    const onBillingExprChange = vi.fn()
    render(
      <TieredPricingEditor
        billingExpr={source}
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Editor mode' }))
    await user.click(screen.getByRole('option', { name: 'Visual editor' }))
    expect(screen.getByDisplayValue(source)).toBeVisible()
    expect(onBillingExprChange).not.toHaveBeenCalled()
  }
)

test('changes logical groups, negation and branch removal through the visual controls', async () => {
  const source =
    'hour("UTC") >= 9 && hour("UTC") < 18 ? tier("on", p * 1) : tier("off", p * 2)'
  const onBillingExprChange = vi.fn()
  render(
    <TieredPricingEditor
      billingExpr={source}
      requestRuleExpr=''
      onBillingExprChange={onBillingExprChange}
      onRequestRuleExprChange={vi.fn()}
    />
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Condition group' }))
  await user.click(screen.getByRole('option', { name: 'Any condition' }))
  await user.click(screen.getByRole('button', { name: 'Condition actions 1' }))
  await user.click(screen.getByRole('menuitem', { name: 'Negate condition' }))
  const negated = onBillingExprChange.mock.lastCall?.[0]
  assert(negated)
  expect(
    evaluateBillingExpression(negated, {
      now: new Date('2026-09-07T10:00:00Z'),
      tokens: { p: 100 },
    })
  ).toMatchObject({ status: 'success', matchedTier: 'off', cost: 200 })
  await user.click(screen.getByRole('button', { name: 'Condition actions 1' }))
  await user.click(screen.getByRole('menuitem', { name: 'Remove negation' }))
  await user.click(screen.getByRole('button', { name: 'Condition actions 1' }))
  await user.click(
    screen.getByRole('menuitem', { name: 'Remove start condition' })
  )
  expect(screen.getByRole('textbox', { name: 'Condition value' })).toHaveValue(
    '18'
  )
  await user.click(screen.getByRole('button', { name: 'Branch actions 1' }))
  await user.click(screen.getByRole('menuitem', { name: 'Remove branch' }))
  expect(onBillingExprChange).toHaveBeenLastCalledWith('tier("off", p * 2)')
})

test('keeps an invalid timezone local until it is corrected', () => {
  const onBillingExprChange = vi.fn()
  render(
    <TieredPricingEditor
      billingExpr={expression}
      requestRuleExpr=''
      onBillingExprChange={onBillingExprChange}
      onRequestRuleExprChange={vi.fn()}
    />
  )
  const timezone = screen.getAllByRole('combobox', { name: 'Timezone' })[0]
  fireEvent.change(timezone, { target: { value: 'Asia/' } })
  expect(timezone).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Choose a valid IANA timezone.')).toBeVisible()
  expect(onBillingExprChange).not.toHaveBeenCalled()
  fireEvent.change(timezone, { target: { value: 'Asia/Tokyo' } })
  expect(timezone).not.toHaveAttribute('aria-invalid')
  expect(onBillingExprChange).toHaveBeenLastCalledWith(
    expression.replaceAll('weekday("Asia/Shanghai")', 'weekday("Asia/Tokyo")')
  )
})

test('preserves legacy numeric drafts when editing an independent time multiplier range', () => {
  const onRequestRuleExprChange = vi.fn()
  render(
    <TieredPricingEditor
      billingExpr='tier("base", p * 3 + c * 9)'
      requestRuleExpr='(hour("Asia/Shanghai") >= 21 || hour("Asia/Shanghai") < 6 ? 0.5 : 1)'
      onBillingExprChange={vi.fn()}
      onRequestRuleExprChange={onRequestRuleExprChange}
    />
  )
  const start = screen.getByRole('spinbutton', { name: 'Start' })
  fireEvent.focus(start)
  fireEvent.change(start, { target: { value: '' } })
  expect(start).toHaveValue(null)
  expect(onRequestRuleExprChange.mock.lastCall?.[0]).toContain('>= 0')
  fireEvent.blur(start)
  expect(start).toHaveValue(0)
})
