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
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import {
  PLUGIN_LOGIN_BROADCAST_CHANNEL,
  type PluginLoginStep,
} from '../../lib/plugin-login'
import { PluginLoginDialog } from '../dialogs/plugin-login-dialog'

const START_URL = '/api/channel/7/plugin_login'
const CONTINUE_URL = '/api/channel/7/plugin_login/continue'
const done: PluginLoginStep = {
  type: 'done',
  credential: {
    index: 0,
    label: 'user@example.com',
    account_id: 'acct_1',
    expires_at: 1_900_000_000,
  },
}

afterEach(() => {
  vi.useRealTimers()
})

/** Replies in order for each URL; a reply with success false is an API error. */
function mockServer(replies: Record<string, unknown[]>) {
  return vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
    const reply = replies[url]?.shift()
    if (reply === undefined) throw new Error(`Unexpected POST ${url}`)
    return { data: reply }
  })
}

function ok(data: unknown) {
  return { success: true, message: '', data }
}

function renderDialog(props: {
  keyIndex?: number | null
  onDone?: () => void
}) {
  const client = new QueryClient()
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <PluginLoginDialog
        open
        onOpenChange={onOpenChange}
        channelId={7}
        keyIndex={props.keyIndex ?? null}
        plugin={{ key: 'acct', name: 'Account Plugin', icon: 'text:AP' }}
        onDone={props.onDone}
      />
    </QueryClientProvider>
  )
  return { onOpenChange }
}

const flush = () => act(() => vi.advanceTimersByTimeAsync(0))

test('the device step polls on the server interval and shows the account when done', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-31T00:00:00Z'))
  const now = Math.floor(Date.now() / 1000)
  const post = mockServer({
    [START_URL]: [
      ok({
        flow: 'flow-1',
        step: {
          type: 'device',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://vendor.example/device',
          verification_uri_complete:
            'https://vendor.example/device?code=ABCD-EFGH',
          interval: 5,
          expires_at: now + 600,
        },
      }),
    ],
    [CONTINUE_URL]: [
      ok({ step: { type: 'pending', interval: 8 } }),
      ok({ step: done }),
    ],
  })
  const onDone = vi.fn()
  renderDialog({ onDone })
  await flush()

  const dialog = screen.getByRole('dialog', {
    name: 'Log in to Account Plugin',
  })
  expect(within(dialog).getByText('ABCD-EFGH')).toBeVisible()
  expect(within(dialog).getByText('Code expires in 10:00')).toBeVisible()
  const link = within(dialog).getByRole('link', {
    name: 'Open verification page',
  })
  expect(link).toHaveAttribute(
    'href',
    'https://vendor.example/device?code=ABCD-EFGH'
  )
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenCalledWith(
    START_URL,
    { key_index: null },
    expect.anything()
  )

  await act(() => vi.advanceTimersByTimeAsync(4_900))
  expect(post).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(100))
  expect(post).toHaveBeenLastCalledWith(
    CONTINUE_URL,
    { flow: 'flow-1', input: { poll: true } },
    expect.anything()
  )
  // Still pending: the code stays and the next poll waits the new interval.
  expect(within(dialog).getByText('ABCD-EFGH')).toBeVisible()
  expect(within(dialog).getByText('Code expires in 9:55')).toBeVisible()
  await act(() => vi.advanceTimersByTimeAsync(7_900))
  expect(post).toHaveBeenCalledTimes(2)
  await act(() => vi.advanceTimersByTimeAsync(100))
  expect(post).toHaveBeenCalledTimes(3)

  expect(within(dialog).getByText('Logged in')).toBeVisible()
  expect(within(dialog).getByText('user@example.com')).toBeVisible()
  expect(within(dialog).getByText('Account ID: acct_1')).toBeVisible()
  expect(onDone).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(post).toHaveBeenCalledTimes(3)
})

test('an expired device code stops polling and can start again', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-31T00:00:00Z'))
  const now = Math.floor(Date.now() / 1000)
  const device = {
    type: 'device',
    user_code: 'WXYZ-1234',
    verification_uri: 'https://vendor.example/device',
    interval: 5,
    expires_at: now + 8,
  }
  const post = mockServer({
    [START_URL]: [
      ok({ flow: 'flow-1', step: device }),
      ok({ flow: 'flow-2', step: { ...device, expires_at: now + 600 } }),
    ],
    [CONTINUE_URL]: [ok({ step: { type: 'pending' } })],
  })
  renderDialog({ keyIndex: 2 })
  await flush()
  await act(() => vi.advanceTimersByTimeAsync(8_000))

  expect(screen.getByText('The code has expired')).toBeVisible()
  expect(
    screen.queryByText('Waiting for you to confirm...')
  ).not.toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(post).toHaveBeenCalledTimes(2)

  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await flush()
  expect(post).toHaveBeenLastCalledWith(
    START_URL,
    { key_index: 2 },
    expect.anything()
  )
  expect(screen.queryByText('The code has expired')).not.toBeInTheDocument()
  expect(
    screen.getByRole('dialog', { name: 'Log in again to Account Plugin' })
  ).toBeVisible()
})

test('the paste step sends the trimmed address and retries a failed attempt', async () => {
  const post = mockServer({
    [START_URL]: [
      ok({
        flow: 'flow-1',
        step: {
          type: 'paste',
          url: 'https://vendor.example/authorize?state=s',
          hint: { en: 'Use the account that owns the plan.' },
        },
      }),
    ],
    [CONTINUE_URL]: [
      { success: false, message: 'The vendor rejected the code' },
      ok({ step: done }),
    ],
  })
  const user = userEvent.setup()
  renderDialog({})

  const dialog = await screen.findByRole('dialog')
  expect(
    await within(dialog).findByText('Use the account that owns the plan.')
  ).toBeVisible()
  expect(
    within(dialog).getByRole('link', { name: 'Open sign-in page' })
  ).toHaveAttribute('href', 'https://vendor.example/authorize?state=s')

  // Without a redirect_uri the step names no address and shows no example.
  const address = within(dialog).getByRole('textbox', {
    name: 'Address after sign-in *',
  })
  expect(address).not.toHaveAttribute('placeholder')
  expect(
    within(dialog).queryByText("That page's address starts with:")
  ).not.toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
  expect(
    await within(dialog).findByText(
      'Paste the full address from the address bar'
    )
  ).toBeVisible()
  expect(post).toHaveBeenCalledTimes(1)

  // A pasted address can end with a line break; Enter adds one, not a submit.
  await user.type(
    address,
    '  http://127.0.0.1:8000/callback?code=1&state=s  {Enter}'
  )
  expect(post).toHaveBeenCalledTimes(1)
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
  const alert = await within(dialog).findByRole('alert')
  expect(within(alert).getByText('The vendor rejected the code')).toBeVisible()

  await user.click(within(alert).getByRole('button', { name: 'Retry' }))
  expect(await within(dialog).findByText('Logged in')).toBeVisible()
  const body = {
    flow: 'flow-1',
    input: { callback_url: 'http://127.0.0.1:8000/callback?code=1&state=s' },
  }
  expect(post).toHaveBeenNthCalledWith(2, CONTINUE_URL, body, expect.anything())
  expect(post).toHaveBeenNthCalledWith(3, CONTINUE_URL, body, expect.anything())
  expect(within(dialog).getByRole('button', { name: 'Done' })).toBeVisible()
})

test('the paste step shows where sign-in ends and an example address from redirect_uri', async () => {
  mockServer({
    [START_URL]: [
      ok({
        flow: 'flow-1',
        step: {
          type: 'paste',
          url: 'https://auth.vendor.example/oauth/authorize?client_id=c&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&state=s',
        },
      }),
    ],
  })
  renderDialog({})
  const dialog = await screen.findByRole('dialog')
  const address = await within(dialog).findByRole('textbox', {
    name: 'Address after sign-in *',
  })
  expect(address).toHaveAttribute(
    'placeholder',
    'http://localhost:1455/auth/callback?code=...&state=...'
  )
  expect(
    within(dialog).getByText("That page's address starts with:")
  ).toBeVisible()
  expect(
    within(dialog).getByText('http://localhost:1455/auth/callback')
  ).toBeVisible()
})

test('the redirect step finishes when the callback tab reports this channel', async () => {
  mockServer({
    [START_URL]: [
      ok({
        flow: 'flow-1',
        step: { type: 'redirect', url: 'https://vendor.example/authorize' },
      }),
    ],
  })
  const onDone = vi.fn()
  renderDialog({ onDone })
  const dialog = await screen.findByRole('dialog')
  expect(
    await within(dialog).findByRole('link', { name: 'Open sign-in page' })
  ).toHaveAttribute('target', '_blank')
  expect(within(dialog).getByText('Waiting for sign-in...')).toBeVisible()

  const sender = new BroadcastChannel(PLUGIN_LOGIN_BROADCAST_CHANNEL)
  try {
    sender.postMessage({ channel_id: 8, step: done })
    sender.postMessage({ channel_id: 7, step: done })
    expect(await within(dialog).findByText('Logged in')).toBeVisible()
  } finally {
    sender.close()
  }
  expect(onDone).toHaveBeenCalledTimes(1)
})

test('a callback the server rejects ends the login and offers a new one', async () => {
  const redirect = { type: 'redirect', url: 'https://vendor.example/authorize' }
  const post = mockServer({
    [START_URL]: [
      ok({ flow: 'flow-1', step: redirect }),
      ok({ flow: 'flow-2', step: redirect }),
    ],
  })
  const rejected =
    'Logged in to a different account than the credential being replaced'
  renderDialog({ keyIndex: 0 })
  const dialog = await screen.findByRole('dialog')
  expect(
    await within(dialog).findByText('Waiting for sign-in...')
  ).toBeVisible()

  const sender = new BroadcastChannel(PLUGIN_LOGIN_BROADCAST_CHANNEL)
  try {
    sender.postMessage({ state: 'flow-9', error: 'Another login failed' })
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()

    sender.postMessage({ state: 'flow-1', error: rejected })
    const alert = await within(dialog).findByRole('alert')
    expect(within(alert).getByText(rejected)).toBeVisible()
  } finally {
    sender.close()
  }
  expect(
    within(dialog).queryByText('Waiting for sign-in...')
  ).not.toBeInTheDocument()
  expect(
    within(dialog).queryByRole('link', { name: 'Open sign-in page' })
  ).not.toBeInTheDocument()
  expect(
    within(dialog).queryByRole('button', { name: 'Retry' })
  ).not.toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Start again' }))
  expect(
    await within(dialog).findByText('Waiting for sign-in...')
  ).toBeVisible()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(post).toHaveBeenCalledTimes(2)
  expect(post).toHaveBeenLastCalledWith(
    START_URL,
    { key_index: 0 },
    expect.anything()
  )
})

test('a credential the server rejects ends the login and offers a new one', async () => {
  const paste = {
    type: 'paste',
    url: 'https://vendor.example/authorize?state=s',
  }
  const rejected =
    'This account is already logged in on another credential of this plugin'
  const post = mockServer({
    [START_URL]: [
      ok({ flow: 'flow-1', step: paste }),
      ok({ flow: 'flow-2', step: paste }),
    ],
    [CONTINUE_URL]: [
      { success: false, message: rejected, message_key: rejected },
    ],
  })
  const user = userEvent.setup()
  renderDialog({})
  const dialog = await screen.findByRole('dialog')
  await user.type(
    await within(dialog).findByRole('textbox', {
      name: 'Address after sign-in *',
    }),
    'http://127.0.0.1:8000/callback?code=1&state=s'
  )
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))

  const alert = await within(dialog).findByRole('alert')
  expect(within(alert).getByText(rejected)).toBeVisible()
  expect(
    within(alert).queryByRole('button', { name: 'Retry' })
  ).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
  expect(
    within(dialog).queryByRole('button', { name: 'Continue' })
  ).not.toBeInTheDocument()

  await user.click(within(alert).getByRole('button', { name: 'Start again' }))
  expect(
    await within(dialog).findByRole('textbox', {
      name: 'Address after sign-in *',
    })
  ).toBeVisible()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(post).toHaveBeenCalledTimes(3)
})

test('the fields step masks password fields and requires values', async () => {
  const post = mockServer({
    [START_URL]: [
      ok({
        flow: 'flow-1',
        step: {
          type: 'fields',
          fields: [
            {
              name: 'api_key',
              label: { en: 'Access token' },
              type: 'password',
              required: true,
            },
            { name: 'region', label: 'Region', type: 'text' },
          ],
        },
      }),
    ],
    [CONTINUE_URL]: [ok({ step: done })],
  })
  const user = userEvent.setup()
  renderDialog({})
  const dialog = await screen.findByRole('dialog')
  const token = await within(dialog).findByLabelText('Access token *')
  expect(token).toHaveAttribute('type', 'password')
  expect(token).toHaveAttribute('autocomplete', 'new-password')

  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
  expect(
    await within(dialog).findByText('This field is required')
  ).toBeVisible()
  expect(post).toHaveBeenCalledTimes(1)

  await user.type(token, 'secret')
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
  expect(await within(dialog).findByText('Logged in')).toBeVisible()
  expect(post).toHaveBeenLastCalledWith(
    CONTINUE_URL,
    { flow: 'flow-1', input: { fields: { api_key: 'secret', region: '' } } },
    expect.anything()
  )
})
