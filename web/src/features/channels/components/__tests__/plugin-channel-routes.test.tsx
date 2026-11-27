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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, expect, test } from 'vitest'

import type { PluginRelayRoute } from '../../api'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  transformFormDataToCreatePayload,
  type ChannelFormValues,
} from '../../lib/channel-form'
import { PluginChannelRoutes } from '../plugin-channel-routes'

const routes: PluginRelayRoute[] = [
  {
    key: '/v1/chat/completions',
    incoming_path: '/v1/chat/completions',
    upstream_path: '/chat',
    default_enabled: true,
  },
  {
    key: '/v1/responses',
    incoming_path: '/v1/responses',
    upstream_path: '/chat',
    converter: 'openai_responses_to_openai_chat_completions',
    default_enabled: false,
  },
]

let form: ReturnType<typeof useForm<ChannelFormValues>>

function Harness(props: {
  toggles?: Record<string, boolean>
  disabled?: boolean
}) {
  form = useForm<ChannelFormValues>({
    defaultValues: {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      type: 61,
      task_plugin_key: 'vendor-x',
      plugin_routes: props.toggles ?? {},
    },
  })
  return (
    <FormProvider {...form}>
      <PluginChannelRoutes routes={routes} disabled={props.disabled} />
    </FormProvider>
  )
}

/** The plugin_routes the channel would save. */
function savedRoutes(): unknown {
  const payload = transformFormDataToCreatePayload(form.getValues())
  return JSON.parse(payload.channel.settings ?? '{}').plugin_routes
}

afterEach(() => {
  cleanup()
})

test('a new channel shows each route at its plugin default and saves no switches', () => {
  render(<Harness />)

  expect(
    screen.getByRole('switch', { name: '/v1/chat/completions' })
  ).toBeChecked()
  expect(
    screen.getByRole('switch', { name: '/v1/responses' })
  ).not.toBeChecked()
  expect(screen.getByText('1 of 2 on')).toBeInTheDocument()
  expect(savedRoutes()).toBeUndefined()
})

test('turning on a route that is off by default saves that switch', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  await user.click(screen.getByRole('switch', { name: '/v1/responses' }))

  expect(screen.getByRole('switch', { name: '/v1/responses' })).toBeChecked()
  expect(screen.getByText('2 of 2 on')).toBeInTheDocument()
  expect(savedRoutes()).toEqual({ '/v1/responses': true })
})

test('switching a route back to its default removes the saved switch', async () => {
  const user = userEvent.setup()
  render(<Harness toggles={{ '/v1/responses': true }} />)

  await user.click(screen.getByRole('switch', { name: '/v1/responses' }))

  expect(savedRoutes()).toBeUndefined()
})

test('turning off a route that is on by default saves it as off', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  await user.click(screen.getByRole('switch', { name: '/v1/chat/completions' }))

  expect(savedRoutes()).toEqual({ '/v1/chat/completions': false })
})

test('a locked form keeps the switches disabled', () => {
  render(<Harness disabled />)

  for (const toggle of screen.getAllByRole('switch')) {
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
  }
})
