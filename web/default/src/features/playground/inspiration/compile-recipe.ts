/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { InspirationRecipe } from './types'

export type RecipeValues = Record<string, string | number>
/** Translated where it is rendered: compileRecipe runs outside React, so it names
 *  the message and leaves the wording to the component. */
export type RecipeFieldError = {
  key: string
  values?: Record<string, number>
}
export type CompileRecipeResult = {
  prompt: string
  errors: Record<string, RecipeFieldError>
  unknown: string[]
}

export function initialRecipeValues(recipe: InspirationRecipe): RecipeValues {
  return Object.fromEntries(
    recipe.variables.map((variable) => [
      variable.key,
      variable.default_value ?? '',
    ])
  )
}

export function compileRecipe(
  recipe: InspirationRecipe,
  values: RecipeValues
): CompileRecipeResult {
  const errors: Record<string, RecipeFieldError> = {}
  for (const variable of recipe.variables) {
    const value = values[variable.key]
    const text = String(value ?? '').trim()
    if (variable.required && !text) errors[variable.key] = { key: 'Required' }
    if (variable.max_length !== null && text.length > variable.max_length) {
      errors[variable.key] = { key: 'Too long' }
    }
    if (variable.type === 'number' && text) {
      const number = Number(value)
      if (!Number.isFinite(number)) {
        errors[variable.key] = { key: 'Enter a valid number' }
      }
      if (variable.min !== null && number < variable.min) {
        errors[variable.key] = {
          key: 'Minimum {{min}}',
          values: { min: variable.min },
        }
      }
      if (variable.max !== null && number > variable.max) {
        errors[variable.key] = {
          key: 'Maximum {{max}}',
          values: { max: variable.max },
        }
      }
    }
  }
  const known = new Set(recipe.variables.map((variable) => variable.key))
  const unknown = new Set<string>()
  const prompt = recipe.prompt_template.replaceAll(
    /\{\{([a-z][a-z0-9_]*)\}\}/g,
    (placeholder, key: string) => {
      if (!known.has(key)) {
        unknown.add(key)
        return placeholder
      }
      return String(values[key] ?? '')
    }
  )
  const finalPrompt = recipe.negative_prompt.trim()
    ? `${prompt}\n\nAvoid: ${recipe.negative_prompt.trim()}`
    : prompt
  return { prompt: finalPrompt, errors, unknown: [...unknown] }
}

export function modelMatches(pattern: string, model: string): boolean {
  const escaped = pattern
    .replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`, 'i').test(model)
}

export function resolveRecipeModel(
  recipe: InspirationRecipe,
  available: string[]
): string | null {
  const compatible = recipe.model_policy.compatible
  const acceptsModality = compatible.some(
    (pattern) => pattern === recipe.modality || pattern === '*'
  )
  for (const pattern of recipe.model_policy.recommended) {
    const match = available.find(
      (model) =>
        modelMatches(pattern, model) &&
        (acceptsModality ||
          compatible.some((item) => modelMatches(item, model)))
    )
    if (match) return match
  }
  if (acceptsModality) return available[0] ?? null
  for (const pattern of compatible) {
    const match = available.find((model) => modelMatches(pattern, model))
    if (match) return match
  }
  return compatible.length === 0 ? (available[0] ?? null) : null
}
