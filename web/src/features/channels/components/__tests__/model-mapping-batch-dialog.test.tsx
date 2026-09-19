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
import { expect, test, vi } from 'vitest'

import { ModelMappingBatchDialog } from '../model-mapping-batch-dialog'

test('upstream names are the default source: stripping a suffix derives request names, skips unchanged models, and syncs the model list', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()
  render(
    <ModelMappingBatchDialog
      open
      onOpenChange={vi.fn()}
      upstreamModels={['gpt-4o-all', 'o3']}
      channelModels={['gpt-4o']}
      onApply={onApply}
    />
  )
  const dialog = within(
    screen.getByRole('dialog', { name: 'Batch add mappings' })
  )
  expect(
    dialog.getByRole('tab', { name: /Upstream model list/ })
  ).toHaveAttribute('aria-selected', 'true')
  expect(
    dialog.getByRole('radio', {
      name: 'Upstream names returned by the provider',
    })
  ).toBeChecked()
  expect(dialog.getByRole('radio', { name: 'Strip suffix' })).toBeChecked()
  expect(
    dialog.getByRole('button', { name: 'Add 0 mapping(s)' })
  ).toBeDisabled()

  await user.click(dialog.getByRole('checkbox', { name: 'gpt-4o-all' }))
  await user.click(dialog.getByRole('checkbox', { name: 'o3' }))
  await user.type(dialog.getByRole('textbox', { name: 'Suffix' }), '-all')
  expect(dialog.getByRole('list', { name: 'Preview' })).toHaveTextContent(
    'gpt-4ogpt-4o-all'
  )
  expect(
    dialog.getByText('1 model(s) unchanged by the rule were skipped')
  ).toBeVisible()

  await user.click(dialog.getByRole('button', { name: 'Add 1 mapping(s)' }))
  expect(onApply).toHaveBeenCalledWith({
    pairs: [{ from: 'gpt-4o', to: 'gpt-4o-all' }],
    syncModels: true,
  })
})

test('the channel-model source flips to request names, offers add rules, and never syncs the model list', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()
  render(
    <ModelMappingBatchDialog
      open
      onOpenChange={vi.fn()}
      upstreamModels={['x-all']}
      channelModels={['gemini-2.5-flash']}
      onApply={onApply}
    />
  )
  const dialog = within(
    screen.getByRole('dialog', { name: 'Batch add mappings' })
  )
  await user.click(dialog.getByRole('tab', { name: /Channel models/ }))
  expect(
    dialog.getByRole('radio', { name: 'Request names your users call' })
  ).toBeChecked()
  expect(dialog.getByRole('radio', { name: 'Add suffix' })).toBeChecked()
  expect(
    dialog.queryByRole('checkbox', { name: /Publish the request names/ })
  ).not.toBeInTheDocument()

  await user.click(dialog.getByRole('checkbox', { name: 'gemini-2.5-flash' }))
  await user.type(dialog.getByRole('textbox', { name: 'Suffix' }), '-all')
  await user.click(dialog.getByRole('button', { name: 'Add 1 mapping(s)' }))
  expect(onApply).toHaveBeenCalledWith({
    pairs: [{ from: 'gemini-2.5-flash', to: 'gemini-2.5-flash-all' }],
    syncModels: false,
  })
})

test('without an upstream list the dialog offers only channel models, and conflicting request names are reported', async () => {
  const user = userEvent.setup()
  render(
    <ModelMappingBatchDialog
      open
      onOpenChange={vi.fn()}
      channelModels={['claude-all', 'claude-latest']}
      onApply={vi.fn()}
    />
  )
  const dialog = within(
    screen.getByRole('dialog', { name: 'Batch add mappings' })
  )
  expect(dialog.queryByRole('tab')).not.toBeInTheDocument()
  expect(
    dialog.getByRole('radio', { name: 'Request names your users call' })
  ).toBeChecked()

  await user.click(
    dialog.getByRole('radio', {
      name: 'Upstream names returned by the provider',
    })
  )
  expect(dialog.getByRole('radio', { name: 'Strip suffix' })).toBeChecked()
  await user.click(dialog.getByRole('checkbox', { name: 'claude-all' }))
  await user.click(dialog.getByRole('checkbox', { name: 'claude-latest' }))
  await user.type(
    dialog.getByRole('textbox', { name: 'Suffix' }),
    '-all, -latest'
  )
  expect(dialog.getByRole('list', { name: 'Preview' })).toHaveTextContent(
    'claudeclaude-all'
  )
  expect(
    dialog.getByText(
      '1 model(s) skipped because another model derives the same request name'
    )
  ).toBeVisible()
  expect(dialog.getByRole('button', { name: 'Add 1 mapping(s)' })).toBeEnabled()
})
