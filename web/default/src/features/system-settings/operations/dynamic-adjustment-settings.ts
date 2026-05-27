import type {
  ChannelDynamicSettings,
  ChannelDynamicSettingsUpdate,
} from '../types'

export const CHANNEL_DYNAMIC_SETTINGS_DEFAULTS: ChannelDynamicSettings = {
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

const SETTINGS_KEYS = Object.keys(
  CHANNEL_DYNAMIC_SETTINGS_DEFAULTS
) as (keyof ChannelDynamicSettings)[]

export function normalizeChannelDynamicSettings(
  settings?: Partial<ChannelDynamicSettings> | null
): ChannelDynamicSettings {
  return {
    ...CHANNEL_DYNAMIC_SETTINGS_DEFAULTS,
    ...settings,
  }
}

export function buildChannelDynamicSettingsPayload(
  settings: ChannelDynamicSettings
): ChannelDynamicSettingsUpdate {
  return SETTINGS_KEYS.reduce<ChannelDynamicSettingsUpdate>((payload, key) => {
    payload[key] = settings[key] as never
    return payload
  }, {})
}

export function getChangedChannelDynamicSettings(
  initial: ChannelDynamicSettings,
  next: ChannelDynamicSettings
): ChannelDynamicSettingsUpdate {
  return SETTINGS_KEYS.reduce<ChannelDynamicSettingsUpdate>((payload, key) => {
    if (next[key] !== initial[key]) {
      payload[key] = next[key] as never
    }
    return payload
  }, {})
}

export function isDynamicSettingsSubmitDisabled({
  disabled,
  saving,
}: {
  disabled?: boolean
  saving?: boolean
}): boolean {
  return Boolean(disabled || saving)
}

export function isDynamicSettingsFormDisabled({
  loading,
}: {
  loading?: boolean
}): boolean {
  return Boolean(loading)
}
