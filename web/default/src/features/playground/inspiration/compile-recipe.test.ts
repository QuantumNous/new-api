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
import { describe, expect, it } from 'vitest'

import {
  compileRecipe,
  modelMatches,
  resolveRecipeModel,
} from './compile-recipe'
import type { InspirationRecipe } from './types'

const recipe = {
  variables: [
    {
      key: 'count',
      label: 'Count',
      type: 'number',
      required: true,
      default_value: 2,
      placeholder: '',
      options: [],
      min: 1,
      max: 4,
      max_length: null,
    },
  ],
  prompt_template: 'Create {{count}} {{unknown}}',
  negative_prompt: 'blur',
  model_policy: { recommended: ['gpt-image-*'], compatible: ['gpt-image-*'] },
} as unknown as InspirationRecipe

describe('compileRecipe', () => {
  it('compiles known values, preserves unknown placeholders, and appends the negative prompt', () => {
    expect(compileRecipe(recipe, { count: 2 })).toEqual({
      prompt: 'Create 2 {{unknown}}\n\nAvoid: blur',
      errors: {},
      unknown: ['unknown'],
    })
  })
  it('validates required numeric bounds', () => {
    expect(compileRecipe(recipe, { count: 0 }).errors.count).toEqual({
      key: 'Minimum {{min}}',
      values: { min: 1 },
    })
    expect(compileRecipe(recipe, { count: 5 }).errors.count).toEqual({
      key: 'Maximum {{max}}',
      values: { max: 4 },
    })
    expect(compileRecipe(recipe, { count: '' }).errors.count).toEqual({
      key: 'Required',
    })
  })
})

describe('recipe model resolution', () => {
  it('supports globs and prioritizes recommended compatible models', () => {
    expect(modelMatches('gpt-image-*', 'gpt-image-2')).toBe(true)
    expect(resolveRecipeModel(recipe, ['other', 'gpt-image-2'])).toBe(
      'gpt-image-2'
    )
  })
  it('blocks when declared compatibility is unavailable', () =>
    expect(resolveRecipeModel(recipe, ['other'])).toBeNull())
  it('accepts every already modality-filtered model for modality policies', () => {
    const modalityRecipe = {
      ...recipe,
      modality: 'image',
      model_policy: { recommended: [], compatible: ['image'] },
    } as InspirationRecipe
    expect(resolveRecipeModel(modalityRecipe, ['gpt-image-2'])).toBe(
      'gpt-image-2'
    )
  })
})
