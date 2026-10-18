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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

import { ParamOverrideEditorDialog } from '../dialogs/param-override-editor-dialog'

const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

async function renderPruneRules(
  conditions: { path: string; mode: string; value: string }[]
) {
  const onSave = vi.fn()
  render(
    <ParamOverrideEditorDialog
      open
      value={JSON.stringify({
        operations: [
          { mode: 'prune_objects', path: 'messages', value: { conditions } },
        ],
      })}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />
  )
  // Wait for the dialog's opening autofocus before testing user-driven focus.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Visual' })).toHaveFocus()
  )
  return onSave
}

test('clearing and retyping a prune path keeps focus on that row and leaves the next rule unchanged', async () => {
  const user = userEvent.setup()
  const onSave = await renderPruneRules([
    { path: 'a', mode: 'full', value: 'x' },
    { path: 'b', mode: 'full', value: 'y' },
  ])
  const firstPath = screen.getByDisplayValue('a')
  await user.clear(firstPath)
  expect(firstPath).toHaveValue('')
  expect(firstPath).toHaveFocus()
  expect(screen.getByDisplayValue('b')).toBeVisible()
  await user.type(firstPath, 'z')
  expect(firstPath).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual({
    operations: [
      {
        mode: 'prune_objects',
        path: 'messages',
        value: {
          conditions: [
            { path: 'z', mode: 'full', value: 'x' },
            { path: 'b', mode: 'full', value: 'y' },
          ],
        },
      },
    ],
  })
})

test('a newly added prune condition stays editable after deleting another row and survives duplication and JSON round-trip', async () => {
  const user = userEvent.setup()
  const onSave = await renderPruneRules([
    { path: 'type', mode: 'full', value: 'legacy' },
  ])
  await user.click(screen.getAllByRole('button', { name: 'Add Condition' })[0])
  const paths = screen.getAllByPlaceholderText('type')
  expect(paths).toHaveLength(2)
  await user.type(paths[1], 'role')
  await user.click(screen.getAllByRole('combobox', { name: 'Match Mode' })[1])
  await user.click(screen.getByRole('option', { name: 'Regex' }))
  await user.type(
    screen.getAllByRole('textbox', { name: 'Match Value (optional)' })[1],
    '(?i)^tool$'
  )
  // The first Delete button belongs to the whole operation.
  await user.click(screen.getAllByRole('button', { name: 'Delete' })[1])
  expect(paths[1]).toBeInTheDocument()
  expect(screen.getAllByPlaceholderText('type')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Duplicate' }))
  await user.click(screen.getByRole('button', { name: 'JSON Text' }))
  await user.click(screen.getByRole('button', { name: 'Visual' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const expected = {
    mode: 'prune_objects',
    path: 'messages',
    value: {
      conditions: [{ path: 'role', mode: 'regex', value: '(?i)^tool$' }],
    },
  }
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual({
    operations: [expected, expected],
  })
})

test('switching prune simple and advanced modes retains unfinished rows but saving omits empty paths', async () => {
  const user = userEvent.setup()
  const onSave = await renderPruneRules([
    { path: 'a', mode: 'regex', value: '^x$' },
    { path: 'b', mode: 'full', value: 'y' },
  ])
  await user.clear(screen.getByDisplayValue('a'))
  await user.click(screen.getByRole('button', { name: 'Simple' }))
  await user.click(screen.getByRole('button', { name: 'Advanced' }))
  const paths = screen.getAllByPlaceholderText('type')
  expect(paths).toHaveLength(2)
  expect(paths[0]).toHaveValue('')
  expect(paths[1]).toHaveValue('b')
  expect(
    screen.getAllByRole('combobox', { name: 'Match Mode' })[0]
  ).toHaveValue('Regex')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual({
    operations: [
      {
        mode: 'prune_objects',
        path: 'messages',
        value: { conditions: [{ path: 'b', mode: 'full', value: 'y' }] },
      },
    ],
  })
  expect(paths[0]).toBeInTheDocument()
})

test('saving an unfinished prune rule is blocked without discarding the draft', async () => {
  const user = userEvent.setup()
  const onSave = await renderPruneRules([])
  await user.click(screen.getAllByRole('button', { name: 'Add Condition' })[0])
  const path = screen.getByPlaceholderText('type')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).not.toHaveBeenCalled()
  expect(path).toBeVisible()
  await user.type(path, 'role')
  await user.type(
    screen.getByRole('textbox', { name: 'Match Value (optional)' }),
    'tool'
  )
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledOnce()
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual({
    operations: [
      {
        mode: 'prune_objects',
        path: 'messages',
        value: { conditions: [{ path: 'role', mode: 'full', value: 'tool' }] },
      },
    ],
  })
})

test('an imported prune rule with an explicit empty type is preserved when saved unchanged', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const payload = {
    operations: [
      { mode: 'prune_objects', path: 'messages', value: { type: '' } },
    ],
  }
  render(
    <ParamOverrideEditorDialog
      open
      value={JSON.stringify(payload)}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledOnce()
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual(payload)
})

test('selecting Regex saves a literal Go pattern with the condition flags', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  render(
    <ParamOverrideEditorDialog
      open
      value={JSON.stringify({
        operations: [
          {
            mode: 'set',
            path: 'matched',
            value: true,
            conditions: [{ path: 'model', mode: 'full', value: 'gpt' }],
          },
        ],
      })}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Expand All' }))
  const mode = screen.getByRole('combobox', { name: 'Match Mode' })
  await user.click(mode)
  expect(mode).toHaveAttribute('aria-expanded', 'true')
  await user.click(screen.getByRole('option', { name: 'Regex' }))
  expect(mode).toHaveValue('Regex')
  const pattern = String.raw`(?i)^gpt-\d`
  fireEvent.change(screen.getByRole('textbox', { name: 'Match Value' }), {
    target: { value: pattern },
  })
  await user.click(screen.getByRole('switch', { name: 'Invert match' }))
  await user.click(
    screen.getByRole('switch', { name: 'Pass when key is missing' })
  )
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledOnce()
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual({
    operations: [
      {
        mode: 'set',
        path: 'matched',
        value: true,
        logic: 'OR',
        conditions: [
          {
            path: 'model',
            mode: 'regex',
            value: pattern,
            invert: true,
            pass_missing_key: true,
          },
        ],
      },
    ],
  })
})

test('importing and duplicating regex rules preserves patterns through JSON and visual modes', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const conditions = [
    ...['1e3', 'null', '[0, 1]', '"quoted"', ' padded ', ''].map((value) => ({
      path: 'model',
      mode: 'regex',
      value,
    })),
    { path: 'seed', mode: 'full', value: 1000 },
  ]
  const operation = {
    mode: 'set',
    path: 'matched',
    value: true,
    logic: 'AND',
    conditions,
  }
  render(
    <ParamOverrideEditorDialog
      open
      value={JSON.stringify({ operations: [operation] })}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Duplicate' }))
  await user.click(screen.getByRole('button', { name: 'JSON Text' }))
  await user.click(screen.getByRole('button', { name: 'Visual' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledOnce()
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual({
    operations: [operation, operation],
  })
})

test('prune-object conditions offer Regex and preserve literal and empty patterns when edited', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const operation = {
    mode: 'prune_objects',
    path: 'messages',
    value: {
      conditions: [{ path: 'role', mode: 'full', value: 'system' }],
    },
  }
  render(
    <ParamOverrideEditorDialog
      open
      value={JSON.stringify({ operations: [operation] })}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />
  )
  await user.click(screen.getByRole('combobox', { name: 'Match Mode' }))
  await user.click(screen.getByRole('option', { name: 'Regex' }))
  const matchValue = screen.getByRole('textbox', {
    name: 'Match Value (optional)',
  })
  fireEvent.change(matchValue, { target: { value: ' 1e3 ' } })
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(JSON.parse(onSave.mock.calls[0][0])).toEqual({
    operations: [
      {
        ...operation,
        value: {
          conditions: [{ path: 'role', mode: 'regex', value: ' 1e3 ' }],
        },
      },
    ],
  })

  await user.clear(matchValue)
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledTimes(2)
  expect(JSON.parse(onSave.mock.calls[1][0])).toEqual({
    operations: [
      {
        ...operation,
        value: {
          conditions: [{ path: 'role', mode: 'regex', value: '' }],
        },
      },
    ],
  })
})
