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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'

import type { ChannelModelMappingRule } from '../../types'
import { ModelMappingRulesEditor } from '../model-mapping-rules-editor'

function Harness(props: {
  initial: ChannelModelMappingRule[]
  onChange?: (rules: ChannelModelMappingRule[]) => void
  onApplyToExisting?: () => void
}) {
  const [rules, setRules] = useState(props.initial)
  return (
    <ModelMappingRulesEditor
      value={rules}
      onChange={(next) => {
        setRules(next)
        props.onChange?.(next)
      }}
      onApplyToExisting={props.onApplyToExisting ?? vi.fn()}
    />
  )
}

test('an empty rule list can add a strip-prefix rule and enables applying to existing models', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const onApplyToExisting = vi.fn()
  render(
    <Harness
      initial={[]}
      onChange={onChange}
      onApplyToExisting={onApplyToExisting}
    />
  )
  const apply = screen.getByRole('button', { name: 'Apply to existing models' })
  expect(apply).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Add rule' }))
  const rule = screen.getByRole('listitem', { name: 'Rule 1' })
  expect(
    within(rule).getByRole('combobox', { name: 'Rule' })
  ).toHaveTextContent('Strip prefix')
  await user.type(
    within(rule).getByRole('textbox', { name: 'Prefix' }),
    'relay/'
  )

  expect(onChange).toHaveBeenLastCalledWith([
    { type: 'strip_prefix', values: 'relay/' },
  ])
  expect(apply).toBeEnabled()
  await user.click(apply)
  expect(onApplyToExisting).toHaveBeenCalledTimes(1)
})

test('changing a rule to regular expression replacement resets its fields and edits pattern and replacement', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <Harness
      initial={[{ type: 'strip_prefix', values: 'relay/' }]}
      onChange={onChange}
    />
  )

  await user.click(screen.getByRole('combobox', { name: 'Rule' }))
  await user.click(
    screen.getByRole('option', { name: 'Replace by regular expression' })
  )
  const pattern = screen.getByRole('textbox', { name: 'Regular expression' })
  expect(pattern).toHaveValue('')
  await user.type(pattern, '(?i)^minimax-m')
  await user.type(
    screen.getByRole('textbox', { name: 'Replace with' }),
    'MiniMax-M'
  )

  expect(onChange).toHaveBeenLastCalledWith([
    {
      type: 'regex_replace',
      find: '(?i)^minimax-m',
      replace_with: 'MiniMax-M',
    },
  ])
})

test('rules can be reordered and removed, with move buttons disabled at the ends', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <Harness
      initial={[
        { type: 'strip_prefix', values: 'relay/' },
        { type: 'add_suffix', value: '-x' },
      ]}
      onChange={onChange}
    />
  )
  const first = screen.getByRole('listitem', { name: 'Rule 1' })
  const second = screen.getByRole('listitem', { name: 'Rule 2' })
  expect(
    within(first).getByRole('button', { name: 'Move rule up' })
  ).toBeDisabled()
  expect(
    within(second).getByRole('button', { name: 'Move rule down' })
  ).toBeDisabled()

  await user.click(within(second).getByRole('button', { name: 'Move rule up' }))
  expect(onChange).toHaveBeenLastCalledWith([
    { type: 'add_suffix', value: '-x' },
    { type: 'strip_prefix', values: 'relay/' },
  ])

  await user.click(
    within(screen.getByRole('listitem', { name: 'Rule 1' })).getByRole(
      'button',
      { name: 'Remove rule' }
    )
  )
  expect(onChange).toHaveBeenLastCalledWith([
    { type: 'strip_prefix', values: 'relay/' },
  ])
  expect(
    screen.queryByRole('listitem', { name: 'Rule 2' })
  ).not.toBeInTheDocument()
})
