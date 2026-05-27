import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildChannelDynamicSettingsPayload,
  getChangedChannelDynamicSettings,
  isDynamicSettingsFormDisabled,
  isDynamicSettingsSubmitDisabled,
  normalizeChannelDynamicSettings,
} from './dynamic-adjustment-settings.ts'
import type { ChannelDynamicSettings } from '../types.ts'

const persistedSettings: ChannelDynamicSettings = {
  enabled: true,
  dry_run: true,
  interval_seconds: 180,
  platform_probe_enabled: false,
  platform_probe_interval_seconds: 600,
  degraded_weight_multiplier: 0.5,
  protected_unhealthy_multiplier: 0.3,
  priority_downgrade_latency_ms: 1500,
  last_available_protection_enabled: true,
}

describe('dynamic adjustment settings helpers', () => {
  test('normalizes missing API values to backend defaults', () => {
    assert.deepEqual(
      normalizeChannelDynamicSettings({
        enabled: false,
        dry_run: false,
      }),
      {
        enabled: false,
        dry_run: false,
        interval_seconds: 180,
        platform_probe_enabled: false,
        platform_probe_interval_seconds: 600,
        degraded_weight_multiplier: 0.5,
        protected_unhealthy_multiplier: 0.3,
        priority_downgrade_latency_ms: 1500,
        last_available_protection_enabled: true,
      }
    )
  })

  test('builds a full backend payload for every editable setting', () => {
    assert.deepEqual(buildChannelDynamicSettingsPayload(persistedSettings), {
      enabled: true,
      dry_run: true,
      interval_seconds: 180,
      platform_probe_enabled: false,
      platform_probe_interval_seconds: 600,
      degraded_weight_multiplier: 0.5,
      protected_unhealthy_multiplier: 0.3,
      priority_downgrade_latency_ms: 1500,
      last_available_protection_enabled: true,
    })
  })

  test('keeps save payload focused on changed settings', () => {
    assert.deepEqual(
      getChangedChannelDynamicSettings(persistedSettings, {
        ...persistedSettings,
        dry_run: false,
        interval_seconds: 300,
        protected_unhealthy_multiplier: 0.25,
      }),
      {
        dry_run: false,
        interval_seconds: 300,
        protected_unhealthy_multiplier: 0.25,
      }
    )
  })

  test('keeps submit available after settings load even before dirty state updates', () => {
    assert.equal(
      isDynamicSettingsSubmitDisabled({ disabled: false, saving: false }),
      false
    )
    assert.equal(
      isDynamicSettingsSubmitDisabled({ disabled: true, saving: false }),
      true
    )
    assert.equal(
      isDynamicSettingsSubmitDisabled({ disabled: false, saving: true }),
      true
    )
  })

  test('keeps form editable after loading even when settings data is missing', () => {
    assert.equal(isDynamicSettingsFormDisabled({ loading: true }), true)
    assert.equal(isDynamicSettingsFormDisabled({ loading: false }), false)
  })
})
