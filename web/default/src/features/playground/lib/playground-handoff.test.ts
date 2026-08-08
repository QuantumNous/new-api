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
import { DEFAULT_CONFIG } from '../constants'
import {
  applyPlaygroundHandoffModel,
  resolvePlaygroundHandoff,
  resolvePlaygroundHandoffModel,
} from './playground-handoff'

describe('resolvePlaygroundHandoff', () => {
  test('retains a requested filtered model and prompt as draft state', () => {
    expect(
      resolvePlaygroundHandoff({
        models: [{ label: 'gpt-4o', value: 'gpt-4o' }],
        model: ' gpt-image-2 ',
        prompt: ' Draw a violet fox ',
      })
    ).toEqual({
      model: 'gpt-image-2',
      prompt: 'Draw a violet fox',
      models: [
        { label: 'gpt-image-2', value: 'gpt-image-2' },
        { label: 'gpt-4o', value: 'gpt-4o' },
      ],
    })
  })

  test('reuses an existing model option without duplicating it', () => {
    const models = [
      { label: 'GPT-image-2', value: 'gpt-image-2' },
      { label: 'gpt-4o', value: 'gpt-4o' },
    ]

    expect(resolvePlaygroundHandoff({ models, model: 'gpt-image-2' })).toEqual({
      model: 'gpt-image-2',
      models,
    })
  })

  test('ignores blank model and prompt values', () => {
    expect(
      resolvePlaygroundHandoff({
        models: [{ label: 'gpt-4o', value: 'gpt-4o' }],
        model: '  ',
        prompt: '\n ',
      })
    ).toEqual({
      models: [{ label: 'gpt-4o', value: 'gpt-4o' }],
    })
  })
})

describe('applyPlaygroundHandoffModel', () => {
  test('uses the requested model for the initial playground state', () => {
    expect(
      applyPlaygroundHandoffModel(DEFAULT_CONFIG, ' gpt-image-2 ')
    ).toEqual({
      ...DEFAULT_CONFIG,
      model: 'gpt-image-2',
    })
  })

  test('keeps the existing config when the requested model is blank', () => {
    expect(applyPlaygroundHandoffModel(DEFAULT_CONFIG, '  ')).toBe(
      DEFAULT_CONFIG
    )
  })
})

describe('resolvePlaygroundHandoffModel', () => {
  test('keeps the applied model after handoff search cleanup', () => {
    expect(resolvePlaygroundHandoffModel(undefined, 'gpt-image-2')).toBe(
      'gpt-image-2'
    )
  })

  test('prefers a new URL model over the retained handoff model', () => {
    expect(resolvePlaygroundHandoffModel(' seedance-2-0 ', 'gpt-image-2')).toBe(
      'seedance-2-0'
    )
  })
})
