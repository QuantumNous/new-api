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

import {
  CHANNEL_FORM_DEFAULT_VALUES,
  resolveStorageModeConversion,
  transformFormDataToUpdatePayload,
} from '../channel-form'

describe('resolveStorageModeConversion', () => {
  test('reports no conversion when creating a channel even if a mode is preselected', () => {
    const result = resolveStorageModeConversion(false, false, {
      key_storage_mode: 'multi',
    })

    expect(result.requestedStorageMode).toBe('single')
    expect(result.isConvertingStorage).toBe(false)
  })

  test('reports a conversion when an edit requests multi for a single-key channel', () => {
    const result = resolveStorageModeConversion(true, false, {
      key_storage_mode: 'multi',
    })

    expect(result.currentStorageMode).toBe('single')
    expect(result.requestedStorageMode).toBe('multi')
    expect(result.isConvertingStorage).toBe(true)
  })

  test('reports a conversion when an edit requests single for a multi-key channel', () => {
    const result = resolveStorageModeConversion(true, true, {
      key_storage_mode: 'single',
    })

    expect(result.currentStorageMode).toBe('multi')
    expect(result.requestedStorageMode).toBe('single')
    expect(result.isConvertingStorage).toBe(true)
  })

  test('falls back to the persisted shape when an edit omits the requested mode', () => {
    const result = resolveStorageModeConversion(true, true, {
      key_storage_mode: undefined,
    })

    expect(result.requestedStorageMode).toBe('multi')
    expect(result.isConvertingStorage).toBe(false)
  })

  test('agrees with the payload transform so the drawer and submit validation cannot diverge', () => {
    const formData = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'openai',
      key: 'sk-a\nsk-b',
      models: 'gpt-4o',
      key_storage_mode: 'multi' as const,
    }
    const { isConvertingStorage } = resolveStorageModeConversion(
      true,
      false,
      formData
    )
    const payload = transformFormDataToUpdatePayload(formData, 12, false)

    expect(isConvertingStorage).toBe(true)
    expect(payload.key_storage_mode).toBe('multi')
  })
})

describe('channel key storage conversion payload', () => {
  test('sends key_storage_mode and rotation when converting a single-key channel to multi-key', () => {
    const payload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        name: 'openai',
        key: 'sk-a\nsk-b',
        models: 'gpt-4o',
        key_storage_mode: 'multi',
        multi_key_type: 'polling',
      },
      12,
      false
    )

    expect(payload.key_storage_mode).toBe('multi')
    expect(payload.multi_key_mode).toBe('polling')
    expect(payload.key).toBe('sk-a\nsk-b')
    expect(payload).not.toHaveProperty('key_mode')
  })

  test('sends key_storage_mode without rotation when converting a multi-key channel to a new single key', () => {
    const payload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        name: 'openai',
        key: 'sk-fresh',
        models: 'gpt-4o',
        key_storage_mode: 'single',
        multi_key_type: 'polling',
      },
      12,
      true
    )

    expect(payload.key_storage_mode).toBe('single')
    expect(payload.key).toBe('sk-fresh')
    expect(payload).not.toHaveProperty('multi_key_mode')
  })

  test('does not send key_storage_mode when the persisted storage shape is unchanged', () => {
    const payload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        name: 'openai',
        models: 'gpt-4o',
        key_storage_mode: 'multi',
        multi_key_type: 'random',
      },
      12,
      true
    )

    expect(payload).not.toHaveProperty('key_storage_mode')
    expect(payload).not.toHaveProperty('multi_key_mode')
    expect(payload).not.toHaveProperty('key')
  })
})
