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
import { describe, expect, test } from 'vitest'

import { CHANNEL_TYPE_TASK_PLUGIN } from '../../constants'
import { channelSchema } from '../../types'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from '../channel-form'

function pluginForm(values: Record<string, unknown> = {}) {
  return channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Plugin channel',
    type: CHANNEL_TYPE_TASK_PLUGIN,
    task_plugin_key: 'vendor-x',
    base_url: 'https://api.vendor.example',
    key: 'ak|sk|us-east-1',
    models: 'model-a,model-b',
    ...values,
  })
}

function settingsOf(payload: { settings?: string | null }) {
  return JSON.parse(payload.settings ?? '{}') as Record<string, unknown>
}

describe('plugin channel settings', () => {
  test('saves the plugin settings the administrator set next to other settings', () => {
    const settings = settingsOf(
      transformFormDataToCreatePayload(
        pluginForm({
          plugin_config: {
            upload_url: 'https://upload.vendor.example',
            regions: { 'model-a': 'eu-west-1' },
          },
          settings: '{"custom_option":true}',
        })
      ).channel
    )

    expect(settings).toMatchObject({
      custom_option: true,
      plugin_config: {
        upload_url: 'https://upload.vendor.example',
        regions: { 'model-a': 'eu-west-1' },
      },
    })
  })

  test('leaves plugin settings out when none is set, so the plugin defaults apply', () => {
    const settings = settingsOf(
      transformFormDataToCreatePayload(
        pluginForm({ settings: '{"plugin_config":{"region":"eu"}}' })
      ).channel
    )

    expect(settings).not.toHaveProperty('plugin_config')
  })

  test('saves model update detection for a plugin channel', () => {
    const settings = settingsOf(
      transformFormDataToCreatePayload(
        pluginForm({
          upstream_model_update_check_enabled: true,
          upstream_model_update_auto_sync_enabled: true,
          upstream_model_update_ignored_models: 'model-c, model-d,model-c',
        })
      ).channel
    )

    expect(settings).toMatchObject({
      upstream_model_update_check_enabled: true,
      upstream_model_update_auto_sync_enabled: true,
      upstream_model_update_ignored_models: ['model-c', 'model-d'],
      upstream_model_update_last_detected_models: [],
      upstream_model_update_last_check_time: 0,
    })
  })

  test('editing keeps saved plugin settings and model update detection unchanged', () => {
    const channel = channelSchema.parse({
      id: 7,
      name: 'Plugin channel',
      type: CHANNEL_TYPE_TASK_PLUGIN,
      key: '',
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
      models: 'model-a',
      group: 'default',
      base_url: 'https://api.vendor.example',
      setting: '{"task_plugin_key":"vendor-x"}',
      settings: JSON.stringify({
        plugin_config: { regions: { 'model-a': 'eu-west-1' } },
        upstream_model_update_check_enabled: true,
        upstream_model_update_ignored_models: ['model-z'],
        upstream_model_update_last_detected_models: ['model-new'],
        upstream_model_update_last_check_time: 1700000000,
      }),
    })
    const form = transformChannelToFormDefaults(channel)

    expect(form.plugin_config).toEqual({
      regions: { 'model-a': 'eu-west-1' },
    })
    expect(form.upstream_model_update_check_enabled).toBe(true)
    expect(settingsOf(transformFormDataToUpdatePayload(form, 7))).toMatchObject(
      {
        plugin_config: { regions: { 'model-a': 'eu-west-1' } },
        upstream_model_update_check_enabled: true,
        upstream_model_update_ignored_models: ['model-z'],
        upstream_model_update_last_detected_models: ['model-new'],
        upstream_model_update_last_check_time: 1700000000,
      }
    )
  })

  test('changing to another provider removes the plugin settings', () => {
    const settings = settingsOf(
      transformFormDataToCreatePayload(
        pluginForm({
          type: 1,
          plugin_config: { region: 'eu' },
          settings: '{"plugin_config":{"region":"eu"}}',
        })
      ).channel
    )

    expect(settings).not.toHaveProperty('plugin_config')
  })

  test('saves field pass-through and the Responses WebSocket switch for a plugin channel', () => {
    const payload = transformFormDataToCreatePayload(
      pluginForm({
        allow_service_tier: true,
        disable_store: true,
        allow_speed: true,
        responses_websocket_enabled: true,
      })
    ).channel

    expect(settingsOf(payload)).toMatchObject({
      allow_service_tier: true,
      disable_store: true,
      allow_speed: true,
    })
    expect(JSON.parse(payload.setting ?? '{}')).toMatchObject({
      task_plugin_key: 'vendor-x',
      responses_websocket_enabled: true,
    })
  })
})
