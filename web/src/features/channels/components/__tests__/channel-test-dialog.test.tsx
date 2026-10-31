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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'

import { channelSchema, type Channel } from '../../types'
import { ChannelsProvider, useChannels } from '../channels-provider'
import { ChannelTestDialog } from '../dialogs/channel-test-dialog'

const RESPONSES = 'OpenAI Responses (/v1/responses)'
const ANTHROPIC = 'Anthropic (/v1/messages)'

function channel(endpoint: string): Channel {
  return channelSchema.parse({
    id: 7,
    name: 'Gateway',
    key: '',
    type: 1,
    status: 1,
    created_time: 0,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    models: 'gpt-test',
    settings: JSON.stringify({ test_endpoint_type: endpoint }),
  })
}

function Harness(props: { initial: Channel }) {
  const { currentRow, setCurrentRow, open, setOpen } = useChannels()
  const [savedEndpoint, setSavedEndpoint] = useState(props.initial)

  return (
    <>
      <button
        type='button'
        onClick={() => {
          setCurrentRow(savedEndpoint)
          setOpen('test-channel')
        }}
      >
        Open test
      </button>
      <button
        type='button'
        onClick={() => {
          const next = channel('anthropic')
          setSavedEndpoint(next)
          if (currentRow) setCurrentRow(next)
        }}
      >
        Save anthropic endpoint
      </button>
      <button
        type='button'
        onClick={() => {
          const next = channel('gemini')
          setSavedEndpoint(next)
          if (currentRow) setCurrentRow(next)
        }}
      >
        Save gemini endpoint
      </button>
      <ChannelTestDialog
        open={open === 'test-channel'}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
      />
    </>
  )
}

function renderDialog(endpoint: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <Harness initial={channel(endpoint)} />
      </ChannelsProvider>
    </QueryClientProvider>
  )
}

function endpointInput() {
  return screen.getByRole('combobox', { name: 'Endpoint Type' })
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open test' }))
  await waitFor(() => expect(endpointInput()).toBeVisible())
}

async function closeDialog(user: ReturnType<typeof userEvent.setup>) {
  const dialog = screen.getByRole('dialog')
  const closeButtons = within(dialog).getAllByRole('button', { name: 'Close' })
  const footerClose = closeButtons.find(
    (button) => button.textContent === 'Close'
  )
  if (!footerClose) throw new Error('footer close button missing')
  await user.click(footerClose)
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

describe('channel test dialog endpoint', () => {
  test('reopening the same channel restores the saved endpoint', async () => {
    const user = userEvent.setup()
    renderDialog('openai-response')

    await openDialog(user)
    expect(endpointInput()).toHaveValue(RESPONSES)

    await closeDialog(user)
    await openDialog(user)

    expect(endpointInput()).toHaveValue(RESPONSES)
  })

  test('reopening after a save while closed uses the new endpoint', async () => {
    const user = userEvent.setup()
    renderDialog('openai-response')

    await openDialog(user)
    await closeDialog(user)
    await user.click(
      screen.getByRole('button', { name: 'Save anthropic endpoint' })
    )
    await openDialog(user)

    expect(endpointInput()).toHaveValue(ANTHROPIC)
  })

  test('a one-off selection stays while the dialog remains open', async () => {
    const user = userEvent.setup()
    renderDialog('openai-response')

    await openDialog(user)
    await user.click(endpointInput())
    await user.click(screen.getByRole('option', { name: ANTHROPIC }))
    await waitFor(() => expect(endpointInput()).toHaveValue(ANTHROPIC))

    fireEvent.click(
      screen.getByRole('button', { name: 'Save gemini endpoint', hidden: true })
    )

    expect(endpointInput()).toHaveValue(ANTHROPIC)
  })
})
