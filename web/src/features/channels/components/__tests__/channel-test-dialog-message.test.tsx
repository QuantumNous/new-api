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
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { channelSchema, type Channel } from '../../types'
import { ChannelsProvider, useChannels } from '../channels-provider'
import { ChannelTestDialog } from '../dialogs/channel-test-dialog'

const testURL = '/api/channel/test/9'
const testResponse = { data: { success: true, time: 0.1 } }
const multiLineMessage = '  First line\nSecond line 😀  '

function DialogChannel(props: { channel: Channel; open: boolean }) {
  const { setCurrentRow } = useChannels()
  useEffect(() => {
    setCurrentRow(props.channel)
  }, [props.channel, setCurrentRow])
  return <ChannelTestDialog open={props.open} onOpenChange={() => {}} />
}

function makeChannel(models: string[] = ['model-a'], id = 9): Channel {
  return channelSchema.parse({
    id,
    name: `Test channel ${id}`,
    type: 1,
    key: '',
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    models: models.join(','),
  })
}

function renderDialog(channel = makeChannel()) {
  const client = new QueryClient()
  const element = (nextChannel: Channel, open: boolean) => (
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <DialogChannel channel={nextChannel} open={open} />
      </ChannelsProvider>
    </QueryClientProvider>
  )
  const view = render(element(channel, true))
  return (nextChannel: Channel, open = true) =>
    view.rerender(element(nextChannel, open))
}

function testMessageField(): Promise<HTMLElement> {
  return screen.findByRole('textbox', { name: 'Test message (optional)' })
}

function testModelButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Test Connection' })
}

async function chooseEndpoint(
  user: ReturnType<typeof userEvent.setup>,
  name: string
): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: 'Endpoint Type' }))
  await user.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name })
  )
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue(testResponse)
  vi.spyOn(api, 'post').mockResolvedValue(testResponse)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

test('a whitespace-only draft sends a legacy test without a message', async () => {
  const user = userEvent.setup()
  renderDialog()

  const field = await testMessageField()
  expect(field).toHaveAccessibleDescription(/Auto detect uses this message/)
  fireEvent.change(field, { target: { value: ' \n\t\u0085' } })
  await user.click(testModelButton())

  expect(api.get).toHaveBeenCalledExactlyOnceWith(
    testURL,
    expect.objectContaining({ params: { model: 'model-a' } })
  )
  expect(api.post).not.toHaveBeenCalled()
})

test.each([
  { scenario: 'multiline text', message: multiLineMessage },
  { scenario: 'a byte order mark', message: '\uFEFF' },
])('$scenario is sent unchanged in the JSON body', async ({ message }) => {
  const user = userEvent.setup()
  renderDialog()

  const field = await testMessageField()
  await user.click(field)
  await user.paste(message)
  await user.click(testModelButton())

  expect(api.post).toHaveBeenCalledExactlyOnceWith(
    testURL,
    { model: 'model-a', message },
    expect.objectContaining({ skipBusinessError: true })
  )
  expect(api.get).not.toHaveBeenCalled()
})

test.each([
  'Image Generation (/v1/images/generations)',
  'Embeddings (/v1/embeddings)',
  'Jina Rerank (/v1/rerank)',
])('selecting %s disables the message for the request', async (name) => {
  const user = userEvent.setup()
  renderDialog()

  const field = await testMessageField()
  fireEvent.change(field, { target: { value: multiLineMessage } })
  await chooseEndpoint(user, name)
  expect(field).toBeDisabled()
  expect(field).toHaveAccessibleDescription(/unavailable for this endpoint/)
  await user.click(testModelButton())

  expect(api.get).toHaveBeenCalledOnce()
  expect(api.post).not.toHaveBeenCalled()
})

test('an oversized message blocks testing until it fits the Unicode limit', async () => {
  const user = userEvent.setup()
  renderDialog()

  const field = await testMessageField()
  const maxLengthMessage = '😀'.repeat(4096)
  fireEvent.change(field, { target: { value: `${maxLengthMessage}😀` } })
  await user.click(
    screen.getByRole('checkbox', { name: 'Select model model-a' })
  )

  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(field).toHaveAccessibleDescription(/at most 4096 characters/)
  expect(testModelButton()).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Test all 1 models' })
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Test selected models' })
  ).toBeDisabled()

  fireEvent.change(field, { target: { value: maxLengthMessage } })
  expect(field).not.toHaveAttribute('aria-invalid', 'true')
  await user.click(testModelButton())
  expect(api.post).toHaveBeenCalledWith(
    testURL,
    { model: 'model-a', message: maxLengthMessage },
    expect.anything()
  )
})

test('testing selected models sends one request per selected model', async () => {
  const user = userEvent.setup()
  renderDialog(makeChannel(['model-a', 'model-b', 'model-c']))

  fireEvent.change(await testMessageField(), {
    target: { value: multiLineMessage },
  })
  await user.click(
    screen.getByRole('checkbox', { name: 'Select model model-a' })
  )
  await user.click(
    screen.getByRole('checkbox', { name: 'Select model model-c' })
  )
  await user.click(screen.getByRole('button', { name: 'Test selected models' }))

  expect(vi.mocked(api.post).mock.calls.map(([, body]) => body)).toEqual([
    { model: 'model-a', message: multiLineMessage },
    { model: 'model-c', message: multiLineMessage },
  ])
})

test('a running batch uses its starting message, endpoint and stream settings', async () => {
  const user = userEvent.setup()
  const models = [
    'model-a',
    'model-b',
    'model-c',
    'model-d',
    'model-e',
    'model-f',
  ]
  let finishFirstRequest!: () => void
  const firstRequest = new Promise<typeof testResponse>((resolve) => {
    finishFirstRequest = () => resolve(testResponse)
  })
  vi.mocked(api.post).mockImplementationOnce(() => firstRequest)
  renderDialog(makeChannel(models))

  const field = await testMessageField()
  fireEvent.change(field, { target: { value: multiLineMessage } })
  await chooseEndpoint(user, 'OpenAI (/v1/chat/completions)')
  await user.click(screen.getByRole('switch', { name: 'Stream Mode' }))
  await user.click(screen.getByRole('button', { name: 'Test all 6 models' }))

  await vi.waitFor(() => expect(api.post).toHaveBeenCalledTimes(5))
  fireEvent.change(field, { target: { value: 'New draft' } })
  await chooseEndpoint(user, 'Jina Rerank (/v1/rerank)')
  await act(async () => finishFirstRequest())

  await screen.findByRole('button', { name: 'Test all 6 models' })
  expect(vi.mocked(api.post).mock.calls.map(([, body]) => body)).toEqual(
    models.map((model) => ({
      model,
      endpoint_type: 'openai',
      stream: true,
      message: multiLineMessage,
    }))
  )
  expect(api.get).not.toHaveBeenCalled()
})

test('reopening the same channel starts with an empty message draft', async () => {
  const channel = makeChannel()
  const updateDialog = renderDialog(channel)

  fireEvent.change(await testMessageField(), {
    target: { value: multiLineMessage },
  })
  updateDialog(channel, false)
  updateDialog(channel)

  expect(await testMessageField()).toHaveValue('')
})

test('changing the channel starts with an empty message draft', async () => {
  const updateDialog = renderDialog()

  fireEvent.change(await testMessageField(), {
    target: { value: multiLineMessage },
  })
  updateDialog(makeChannel(['model-b'], 10))

  await screen.findByRole('dialog', { name: /Test channel 10/ })
  expect(await testMessageField()).toHaveValue('')
})
