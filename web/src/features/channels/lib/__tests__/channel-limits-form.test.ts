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

import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'

import { channelSchema } from '../../types'
import { getChannelConfigurationState } from '../channel-configuration'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
  type ChannelFormValues,
} from '../channel-form'

const limitedChannel = channelSchema.parse({
  id: 42,
  name: 'Limited channel',
  type: 1,
  key: '',
  status: 1,
  created_time: 1,
  test_time: 0,
  response_time: 0,
  balance_updated_time: 0,
  models: 'custom-model',
  group: 'default',
  base_url: 'https://saved.example',
  rpm_limit: 12,
  tpm_limit: 3400,
  daily_quota_limit: 500000,
  monthly_quota_limit: 7500000,
})

const baseValues: ChannelFormValues = {
  ...CHANNEL_FORM_DEFAULT_VALUES,
  name: 'Limited channel',
  type: 1,
}

describe('channel rate and quota limit form mapping', () => {
  test('maps stored quota-unit limits to form values in display currency', () => {
    const defaults = transformChannelToFormDefaults(limitedChannel)

    expect(defaults.rpm_limit).toBe(12)
    expect(defaults.tpm_limit).toBe(3400)
    expect(defaults.daily_quota_dollars).toBe(quotaUnitsToDollars(500000))
    expect(defaults.monthly_quota_dollars).toBe(quotaUnitsToDollars(7500000))
  })

  test('maps missing limits to zero defaults for new channels', () => {
    const unlimited = channelSchema.parse({
      ...limitedChannel,
      rpm_limit: null,
      tpm_limit: null,
      daily_quota_limit: null,
      monthly_quota_limit: null,
    })
    const defaults = transformChannelToFormDefaults(unlimited)

    expect(defaults.rpm_limit).toBe(0)
    expect(defaults.tpm_limit).toBe(0)
    expect(defaults.daily_quota_dollars).toBe(0)
    expect(defaults.monthly_quota_dollars).toBe(0)

    expect(CHANNEL_FORM_DEFAULT_VALUES.rpm_limit).toBe(0)
    expect(CHANNEL_FORM_DEFAULT_VALUES.tpm_limit).toBe(0)
    expect(CHANNEL_FORM_DEFAULT_VALUES.daily_quota_dollars).toBe(0)
    expect(CHANNEL_FORM_DEFAULT_VALUES.monthly_quota_dollars).toBe(0)
  })

  test('round-trips limits through create and update payloads', () => {
    const defaults = {
      ...baseValues,
      rpm_limit: 12,
      tpm_limit: 3400,
      daily_quota_dollars: quotaUnitsToDollars(500000),
      monthly_quota_dollars: quotaUnitsToDollars(7500000),
    }

    const createChannel = transformFormDataToCreatePayload(defaults)
      .channel
    expect(createChannel.rpm_limit).toBe(12)
    expect(createChannel.tpm_limit).toBe(3400)
    expect(createChannel.daily_quota_limit).toBe(
      parseQuotaFromDollars(quotaUnitsToDollars(500000))
    )
    expect(createChannel.monthly_quota_limit).toBe(
      parseQuotaFromDollars(quotaUnitsToDollars(7500000))
    )

    const updatePayload = transformFormDataToUpdatePayload(defaults, 42)
    expect(updatePayload.rpm_limit).toBe(12)
    expect(updatePayload.tpm_limit).toBe(3400)
    expect(updatePayload.daily_quota_limit).toBe(
      parseQuotaFromDollars(quotaUnitsToDollars(500000))
    )
    expect(updatePayload.monthly_quota_limit).toBe(
      parseQuotaFromDollars(quotaUnitsToDollars(7500000))
    )
  })

  test('rejects a positive quota that would convert to zero quota units', () => {
    const result = channelFormSchema.safeParse({
      ...baseValues,
      models: 'custom-model',
      daily_quota_dollars: 1e-9,
      monthly_quota_dollars: 1e-9,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        'Quota value is too small and would be saved as unlimited'
      )
    }
  })

  test('keeps zero and representable quota values valid', () => {
    const zeroLimits = channelFormSchema.safeParse({
      ...baseValues,
      models: 'custom-model',
      daily_quota_dollars: 0,
      monthly_quota_dollars: 0,
    })
    expect(zeroLimits.success).toBe(true)

    const representable = channelFormSchema.safeParse({
      ...baseValues,
      models: 'custom-model',
      daily_quota_dollars: quotaUnitsToDollars(500000),
      monthly_quota_dollars: quotaUnitsToDollars(7500000),
    })
    expect(representable.success).toBe(true)
  })

  test('sends explicit zeros when every limit is cleared', () => {
    const cleared = { ...baseValues }

    const updatePayload = transformFormDataToUpdatePayload(cleared, 42)
    // Explicit zeros must reach the API so the GORM pointer columns lift a
    // previously configured limit instead of keeping the stored value.
    expect(updatePayload.rpm_limit).toBe(0)
    expect(updatePayload.tpm_limit).toBe(0)
    expect(updatePayload.daily_quota_limit).toBe(0)
    expect(updatePayload.monthly_quota_limit).toBe(0)
  })

  test('marks the rate and quota limits block configured when any limit is set', () => {
    const untouched = getChannelConfigurationState(baseValues, {}, false)
    expect(untouched.blocks.rateAndQuotaLimits).toBe('idle')

    const configured = getChannelConfigurationState(
      { ...baseValues, tpm_limit: 100 },
      {},
      false
    )
    expect(configured.blocks.rateAndQuotaLimits).toBe('configured')

    const quotaOnly = getChannelConfigurationState(
      { ...baseValues, daily_quota_dollars: 2 },
      {},
      false
    )
    expect(quotaOnly.blocks.rateAndQuotaLimits).toBe('configured')
  })
})
