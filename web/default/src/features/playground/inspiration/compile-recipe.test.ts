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
