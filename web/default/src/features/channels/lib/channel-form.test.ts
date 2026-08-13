import { describe, expect, test } from 'bun:test'
import type { Channel } from '../types'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  inspectSolanaPrivateKey,
  resolveBlockRunCreateBaseURL,
  resolveBlockRunPaymentChainChange,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from './channel-form'

const baseChannel: Channel = {
  id: 1,
  type: 1,
  key: '',
  openai_organization: null,
  test_model: null,
  status: 1,
  name: 'primary',
  weight: 1,
  max_concurrency: 0,
  created_time: 0,
  test_time: 0,
  response_time: 0,
  base_url: null,
  other: '',
  balance: 0,
  balance_updated_time: 0,
  models: 'gpt-4o',
  group: 'default',
  used_quota: 0,
  model_mapping: null,
  status_code_mapping: null,
  priority: 0,
  auto_ban: 1,
  other_info: '',
  tag: null,
  setting: null,
  param_override: null,
  header_override: null,
  remark: '',
  max_input_tokens: 0,
  channel_info: {
    is_multi_key: false,
    multi_key_size: 0,
    multi_key_polling_index: 0,
    multi_key_mode: 'random',
  },
  settings: '{}',
}

const codexFormValues = {
  ...CHANNEL_FORM_DEFAULT_VALUES,
  type: 57,
  allow_service_tier: true,
}

describe('channel max concurrency form mapping', () => {
  test('maps max_concurrency between API data and form payloads', () => {
    const channel = {
      ...baseChannel,
      max_concurrency: 7,
    } as Channel

    const defaults = transformChannelToFormDefaults(channel)
    expect(
      (defaults as unknown as { max_concurrency?: number }).max_concurrency
    ).toBe(7)

    const createPayload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'primary',
      key: 'sk-test',
      models: 'gpt-4o',
      max_concurrency: 5,
    })
    expect(
      (createPayload.channel as Record<string, unknown>).max_concurrency
    ).toBe(5)

    const updatePayload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        name: 'primary',
        models: 'gpt-4o',
        max_concurrency: 3,
      },
      1
    )
    expect((updatePayload as Record<string, unknown>).max_concurrency).toBe(3)
  })

  test('rejects negative max_concurrency values', () => {
    const result = channelFormSchema.safeParse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      max_concurrency: -1,
    })

    expect(result.success).toBe(false)
  })
})

describe('Codex OAuth service tier settings', () => {
  test('keeps allow_service_tier in create payloads', () => {
    const payload = transformFormDataToCreatePayload(codexFormValues)

    expect(JSON.parse(payload.channel.settings || '{}')).toMatchObject({
      allow_service_tier: true,
    })
  })

  test('keeps allow_service_tier in update payloads', () => {
    const payload = transformFormDataToUpdatePayload(codexFormValues, 123)

    expect(JSON.parse(payload.settings || '{}')).toMatchObject({
      allow_service_tier: true,
    })
  })
})

describe('GitHub Copilot credential mode', () => {
  test('allows one credential only', () => {
    const single = channelFormSchema.safeParse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'copilot',
      models: 'gpt-4o',
      type: 112,
      multi_key_mode: 'single',
    })
    const batch = channelFormSchema.safeParse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'copilot',
      models: 'gpt-4o',
      type: 112,
      multi_key_mode: 'batch',
    })
    const multiToSingle = channelFormSchema.safeParse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'copilot',
      models: 'gpt-4o',
      type: 112,
      multi_key_mode: 'multi_to_single',
    })

    expect(single.success).toBe(true)
    expect(batch.success).toBe(false)
    expect(multiToSingle.success).toBe(false)
  })
})

describe('BlockRun payment chain form mapping', () => {
  test('forces the Solana URL on create but preserves Base and edit URLs', () => {
    expect(
      resolveBlockRunCreateBaseURL({
        channelType: 100,
        isEditing: false,
        paymentChain: 'solana',
        currentBaseUrl: 'https://stale.example/api',
      })
    ).toBe('https://sol.blockrun.ai/api')
    expect(
      resolveBlockRunCreateBaseURL({
        channelType: 100,
        isEditing: false,
        paymentChain: 'base',
        currentBaseUrl: 'https://custom.example/api',
      })
    ).toBe('https://custom.example/api')
    expect(
      resolveBlockRunCreateBaseURL({
        channelType: 100,
        isEditing: true,
        paymentChain: 'solana',
        currentBaseUrl: 'https://legacy.example/api',
      })
    ).toBe('https://legacy.example/api')
  })

  test('keeps the payment chain and URL unchanged while editing', () => {
    expect(
      resolveBlockRunPaymentChainChange({
        channelType: 100,
        isEditing: true,
        currentChain: 'base',
        currentBaseUrl: 'https://custom.example/api',
        requestedChain: 'solana',
      })
    ).toEqual({
      paymentChain: 'base',
      baseUrl: 'https://custom.example/api',
    })
  })

  test('maps payment chain changes to official URLs only while creating', () => {
    expect(
      resolveBlockRunPaymentChainChange({
        channelType: 100,
        isEditing: false,
        currentChain: 'base',
        currentBaseUrl: 'https://custom.example/api',
        requestedChain: 'solana',
      })
    ).toEqual({
      paymentChain: 'solana',
      baseUrl: 'https://sol.blockrun.ai/api',
    })
  })

  test('treats a missing payment chain as Base when editing', () => {
    const defaults = transformChannelToFormDefaults({
      ...baseChannel,
      type: 100,
      settings: '{}',
    })

    expect(defaults.blockrun_payment_chain).toBe('base')
    expect(defaults.blockrun_max_payment_atomic).toBe('')
  })

  test('restores Solana settings when editing', () => {
    const defaults = transformChannelToFormDefaults({
      ...baseChannel,
      type: 100,
      base_url: 'https://sol.blockrun.ai/api',
      settings: JSON.stringify({
        blockrun_payment_chain: 'solana',
        blockrun_max_payment_atomic: '2500000',
      }),
    })

    expect(defaults.blockrun_payment_chain).toBe('solana')
    expect(defaults.blockrun_max_payment_atomic).toBe('2500000')
  })

  test('serializes Solana settings for create and update payloads', () => {
    const values = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'blockrun-solana',
      type: 100,
      base_url: 'https://sol.blockrun.ai/api/',
      key: 'solana-secret',
      models: 'gpt-4o',
      blockrun_payment_chain: 'solana' as const,
      blockrun_max_payment_atomic: '2500000',
    }

    const createPayload = transformFormDataToCreatePayload(values)
    expect(createPayload.channel.base_url).toBe('https://sol.blockrun.ai/api')
    expect(JSON.parse(createPayload.channel.settings || '{}')).toMatchObject({
      blockrun_payment_chain: 'solana',
      blockrun_max_payment_atomic: '2500000',
    })

    const updatePayload = transformFormDataToUpdatePayload(
      { ...values, key: '' },
      100
    )
    expect(updatePayload.key).toBeUndefined()
    expect(JSON.parse(updatePayload.settings || '{}')).toMatchObject({
      blockrun_payment_chain: 'solana',
      blockrun_max_payment_atomic: '2500000',
    })
  })

  test('removes Solana-only settings for Base and other channel types', () => {
    const staleSettings = JSON.stringify({
      blockrun_payment_chain: 'solana',
      blockrun_max_payment_atomic: '2500000',
    })
    const basePayload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'blockrun-base',
      type: 100,
      models: 'gpt-4o',
      settings: staleSettings,
      blockrun_payment_chain: 'base',
    })
    expect(JSON.parse(basePayload.channel.settings || '{}')).toEqual({
      blockrun_payment_chain: 'base',
    })

    const videoPayload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'blockrun-video',
      type: 101,
      models: 'seedance',
      settings: staleSettings,
      blockrun_payment_chain: 'solana',
      blockrun_max_payment_atomic: '2500000',
    })
    expect(JSON.parse(videoPayload.channel.settings || '{}')).toEqual({})
  })

  test('requires the official Solana URL and a positive decimal cap', () => {
    const validValues = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'blockrun-solana',
      type: 100,
      base_url: 'https://sol.blockrun.ai/api/',
      key: '11111111111111111111111111111111',
      models: 'gpt-4o',
      blockrun_payment_chain: 'solana' as const,
      blockrun_max_payment_atomic: '18446744073709551616',
    }
    expect(channelFormSchema.safeParse(validValues).success).toBe(true)

    expect(
      channelFormSchema.safeParse({
        ...validValues,
        base_url: 'https://blockrun.ai/api',
      }).success
    ).toBe(false)
    expect(
      channelFormSchema.safeParse({
        ...validValues,
        blockrun_max_payment_atomic: '0',
      }).success
    ).toBe(false)
    expect(
      channelFormSchema.safeParse({
        ...validValues,
        blockrun_max_payment_atomic: '1.5',
      }).success
    ).toBe(false)
  })

  test('validates Solana key lengths and extracts a keypair payer', () => {
    const seed = '11111111111111111111111111111111'
    const keypair = '1'.repeat(64)

    expect(inspectSolanaPrivateKey(seed)).toEqual({
      kind: 'seed',
      valid: true,
      payer: null,
    })
    expect(inspectSolanaPrivateKey(keypair)).toEqual({
      kind: 'keypair',
      valid: true,
      payer: seed,
    })
    expect(inspectSolanaPrivateKey('0OIl')).toEqual({
      kind: 'invalid',
      valid: false,
      payer: null,
    })
    expect(inspectSolanaPrivateKey('')).toEqual({
      kind: 'empty',
      valid: true,
      payer: null,
    })
  })

  test('rejects a non-empty invalid Solana key but permits blank edit input', () => {
    const values = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'blockrun-solana',
      type: 100,
      base_url: 'https://sol.blockrun.ai/api',
      models: 'gpt-4o',
      blockrun_payment_chain: 'solana' as const,
      blockrun_max_payment_atomic: '1000000',
    }

    expect(
      channelFormSchema.safeParse({ ...values, key: 'invalid' }).success
    ).toBe(false)
    expect(channelFormSchema.safeParse({ ...values, key: '' }).success).toBe(
      true
    )
  })
})
