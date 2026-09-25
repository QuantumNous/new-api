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
import { describe, expect, it, vi } from 'vitest'

import { ChannelSelectorDialog } from '../channel-selector-dialog'

const channels = [
  { id: 1, name: 'Upstream', base_url: 'https://example.test', status: 1 },
]

function DialogFixture(props: { endpoints?: Record<number, string> }) {
  const [endpoints, setEndpoints] = useState(props.endpoints ?? {})
  return (
    <ChannelSelectorDialog
      open
      onOpenChange={vi.fn()}
      channels={channels}
      selectedChannelIds={[]}
      onSelectedChannelIdsChange={vi.fn()}
      channelEndpoints={endpoints}
      onChannelEndpointsChange={setEndpoints}
      onConfirm={vi.fn()}
    />
  )
}

function endpointSelect() {
  return within(
    screen.getByRole('row', { name: /https:\/\/example.test/ })
  ).getByRole('combobox')
}

describe('channel price source endpoints', () => {
  it('keeps custom selected with an empty editable input after switching from the default', async () => {
    const user = userEvent.setup()
    render(<DialogFixture />)
    expect(endpointSelect()).toHaveTextContent('pricing')

    await user.click(endpointSelect())
    await user.click(screen.getByRole('option', { name: 'custom' }))

    expect(endpointSelect()).toHaveTextContent('custom')
    expect(screen.getByPlaceholderText('/your/endpoint')).toBeVisible()
    expect(screen.getByPlaceholderText('/your/endpoint')).toHaveValue('')
  })

  it('keeps the custom input visible after editing and clearing a saved endpoint', async () => {
    const user = userEvent.setup()
    render(<DialogFixture endpoints={{ 1: '/custom/pricing' }} />)
    await user.click(screen.getByPlaceholderText('/your/endpoint'))
    await user.keyboard('{Control>}a{/Control}')
    await user.paste('/custom/ratios')
    expect(screen.getByPlaceholderText('/your/endpoint')).toHaveValue(
      '/custom/ratios'
    )

    await user.clear(screen.getByPlaceholderText('/your/endpoint'))

    expect(endpointSelect()).toHaveTextContent('custom')
    expect(screen.getByPlaceholderText('/your/endpoint')).toHaveValue('')
    expect(screen.getByPlaceholderText('/your/endpoint')).toBeVisible()
  })

  it.each([
    ['/api/pricing', 'pricing'],
    ['/api/ratio_config', 'ratio_config'],
    ['openrouter', 'OpenRouter'],
  ])(
    'preserves preset %s and allows switching back from custom',
    async (endpoint, label) => {
      const user = userEvent.setup()
      render(<DialogFixture endpoints={{ 1: endpoint }} />)
      expect(endpointSelect()).toHaveTextContent(label)
      expect(
        screen.queryByPlaceholderText('/your/endpoint')
      ).not.toBeInTheDocument()

      await user.click(endpointSelect())
      await user.click(screen.getByRole('option', { name: 'custom' }))
      expect(screen.getByPlaceholderText('/your/endpoint')).toHaveValue('')
      await user.click(endpointSelect())
      await user.click(screen.getByRole('option', { name: label }))

      expect(endpointSelect()).toHaveTextContent(label)
      expect(
        screen.queryByPlaceholderText('/your/endpoint')
      ).not.toBeInTheDocument()
    }
  )
})
