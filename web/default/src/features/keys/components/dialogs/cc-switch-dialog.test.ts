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
import { describe, expect, test } from 'bun:test'
import {
  getCCSwitchModelAccessState,
  getCCSwitchModelPlaceholderKey,
  validateCCSwitchModels,
} from './cc-switch-dialog'

describe('CCSwitchDialog model access', () => {
  test('distinguishes loading, error, empty, and ready states', () => {
    expect(
      getCCSwitchModelAccessState({
        isPending: true,
        isError: false,
        hasData: false,
        modelCount: 0,
      })
    ).toBe('loading')
    expect(
      getCCSwitchModelAccessState({
        isPending: false,
        isError: true,
        hasData: false,
        modelCount: 0,
      })
    ).toBe('error')
    expect(
      getCCSwitchModelAccessState({
        isPending: false,
        isError: false,
        hasData: true,
        modelCount: 0,
      })
    ).toBe('empty')
    expect(
      getCCSwitchModelAccessState({
        isPending: false,
        isError: false,
        hasData: true,
        modelCount: 2,
      })
    ).toBe('ready')
  })

  test('fails closed when a background refresh fails with cached models', () => {
    expect(
      getCCSwitchModelAccessState({
        isPending: false,
        isError: true,
        hasData: true,
        modelCount: 2,
      })
    ).toBe('error')
  })

  test('selects the placeholder key without nested conditional rendering', () => {
    expect(getCCSwitchModelPlaceholderKey('loading')).toBe('Loading...')
    expect(getCCSwitchModelPlaceholderKey('error')).toBe(
      'Unable to load available models'
    )
    expect(getCCSwitchModelPlaceholderKey('empty')).toBe(
      'No callable models available for this API key'
    )
  })

  test('rejects every non-empty model field that is no longer callable', () => {
    const callableModels = new Set(['claude-primary', 'claude-haiku'])

    expect(
      validateCCSwitchModels(
        'claude',
        {
          model: 'claude-primary',
          haikuModel: 'claude-haiku',
          sonnetModel: 'removed-sonnet',
        },
        callableModels
      )
    ).toBe('invalid-selection')
    expect(
      validateCCSwitchModels(
        'claude',
        { model: 'claude-primary', haikuModel: 'claude-haiku' },
        callableModels
      )
    ).toBeNull()
  })

  test('requires the primary model for every application', () => {
    expect(validateCCSwitchModels('codex', {}, new Set(['gpt-5']))).toBe(
      'missing-required'
    )
  })
})
