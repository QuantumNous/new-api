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
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, expect, test, vi } from 'vitest'

import { fromRequestPluginConfigDraft } from '@/features/task-plugins/lib/request-plugins'
import type { RequestPluginConfigSchema } from '@/features/task-plugins/types'

import {
  CHANNEL_FORM_DEFAULT_VALUES,
  type ChannelFormValues,
} from '../../lib/channel-form'
import { ChannelPluginConfigFields } from '../drawers/channel-plugin-config-fields'

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: (icon: string) => <span data-testid={`icon-${icon}`} />,
}))

const schema: RequestPluginConfigSchema = {
  type: 'object',
  properties: {
    upload_url: {
      type: 'string',
      format: 'url',
      title: 'Upload address',
      default: 'https://upload.vendor.example',
    },
    region: {
      type: 'string',
      title: 'Region',
      enum: ['cn-north', 'us-east'],
      enumTitles: ['China North', 'US East'],
      default: 'cn-north',
    },
    regions: {
      type: 'object',
      title: 'Region per model',
      additionalProperties: { type: 'string', title: 'Region' },
    },
  },
}

const models = ['gpt-5', 'claude-opus-4-7', 'custom-model']

let form: ReturnType<typeof useForm<ChannelFormValues>>

function Harness(props: { config?: Record<string, unknown> }) {
  form = useForm<ChannelFormValues>({
    defaultValues: {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      plugin_config: props.config ?? {},
    },
  })
  return (
    <FormProvider {...form}>
      <ChannelPluginConfigFields
        pluginKey='vendor-x'
        schema={schema}
        models={models}
      />
    </FormProvider>
  )
}

/** What the channel would save, as the drawer converts it on submit. */
function savedConfig() {
  const draft = form.getValues('plugin_config_draft')
  return draft
    ? fromRequestPluginConfigDraft(schema, draft).config
    : form.getValues('plugin_config')
}

afterEach(() => {
  cleanup()
})

test('an address field shows its default as the example and saves only what is typed', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  const address = screen.getByRole('textbox', { name: 'Upload address' })
  expect(address).toHaveValue('')
  expect(address).toHaveAttribute(
    'placeholder',
    'https://upload.vendor.example'
  )
  // The test i18n escapes interpolated values, so the slashes are not matched.
  expect(
    screen.getByText(/^Example: https:.*upload\.vendor\.example$/)
  ).toBeInTheDocument()
  expect(savedConfig()).toEqual({})

  await user.type(address, 'https://eu.upload.vendor.example')
  expect(savedConfig()).toEqual({
    upload_url: 'https://eu.upload.vendor.example',
  })
})

test('a value per model offers the channel models with their icons and saves each model with its value', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(screen.getByText('None added yet')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Add model' }))
  const firstRow = screen.getByRole('group', { name: 'Region per model 1' })
  await user.click(within(firstRow).getByRole('combobox', { name: 'Model' }))
  const options = screen.getAllByRole('option')
  expect(options.map((option) => option.textContent)).toEqual(models)
  expect(within(options[0]).getByTestId(/^icon-OpenAI/)).toBeInTheDocument()
  expect(within(options[1]).getByTestId(/^icon-Claude/)).toBeInTheDocument()

  await user.click(screen.getByRole('option', { name: 'gpt-5' }))
  await user.type(
    within(firstRow).getByRole('textbox', { name: 'Region' }),
    'us-east-1'
  )
  expect(savedConfig()).toEqual({ regions: { 'gpt-5': 'us-east-1' } })

  // A model already set is not offered again.
  await user.click(screen.getByRole('button', { name: 'Add model' }))
  const secondRow = screen.getByRole('group', { name: 'Region per model 2' })
  await user.click(within(secondRow).getByRole('combobox', { name: 'Model' }))
  expect(
    screen.getAllByRole('option').map((option) => option.textContent)
  ).toEqual(['claude-opus-4-7', 'custom-model'])
})

test('saved values per model are shown for editing and a deleted model is left out', async () => {
  const user = userEvent.setup()
  render(
    <Harness
      config={{
        regions: { 'gpt-5': 'us-east-1', 'custom-model': 'eu-west-1' },
      }}
    />
  )

  const firstRow = screen.getByRole('group', { name: 'Region per model 1' })
  expect(within(firstRow).getByRole('combobox', { name: 'Model' })).toHaveValue(
    'gpt-5'
  )
  expect(within(firstRow).getByRole('textbox', { name: 'Region' })).toHaveValue(
    'us-east-1'
  )

  await user.click(
    screen.getByRole('button', { name: 'Delete Region per model 1' })
  )
  expect(savedConfig()).toEqual({ regions: { 'custom-model': 'eu-west-1' } })
})

test('the same model set twice is marked on its line', async () => {
  const user = userEvent.setup()
  render(<Harness config={{ regions: { 'gpt-5': 'us-east-1' } }} />)

  await user.click(screen.getByRole('button', { name: 'Add model' }))
  const secondRow = screen.getByRole('group', { name: 'Region per model 2' })
  await user.type(
    within(secondRow).getByRole('combobox', { name: 'Model' }),
    'gpt-5'
  )
  await user.type(
    within(secondRow).getByRole('textbox', { name: 'Region' }),
    'eu-west-1'
  )
  expect(
    within(secondRow).getByText('This model is already set')
  ).toBeInTheDocument()
  expect(
    within(secondRow).getByRole('combobox', { name: 'Model' })
  ).toHaveAttribute('aria-invalid', 'true')
  const firstRow = screen.getByRole('group', { name: 'Region per model 1' })
  expect(
    within(firstRow).queryByText('This model is already set')
  ).not.toBeInTheDocument()
})

test('a choice left empty shows the default that applies to it', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  const region = screen.getByRole('combobox', { name: 'Region' })
  expect(region).toHaveTextContent('China North')
  expect(savedConfig()).toEqual({})

  await user.click(region)
  await user.click(await screen.findByRole('option', { name: 'US East' }))
  expect(savedConfig()).toEqual({ region: 'us-east' })
})
