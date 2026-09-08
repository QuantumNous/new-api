import { describe, expect, it } from 'vitest'

import { stripSensitiveUpdateFields } from '../use-channel-mutate-form'

describe('channel sensitive update fields', () => {
  it('removes actual upstream URL for non-superadmins with sensitive write access', () => {
    const payload = {
      name: 'channel',
      base_url: 'https://public.example/v1',
      actual_base_url: 'https://user:secret@internal.example/v1',
      models: 'gpt-4o',
    }

    expect(stripSensitiveUpdateFields(payload, true, false)).toEqual({
      name: 'channel',
      base_url: 'https://public.example/v1',
      models: 'gpt-4o',
    })
    expect(stripSensitiveUpdateFields(payload, false, false)).toEqual({
      name: 'channel',
      models: 'gpt-4o',
    })
    expect(stripSensitiveUpdateFields(payload, true, true)).toEqual(payload)
  })
})
