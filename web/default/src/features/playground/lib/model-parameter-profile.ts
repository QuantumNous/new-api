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
import type { ParameterEnabled } from '../types'

export type PlaygroundParameterKey = keyof ParameterEnabled

type ModelParameterProfile = {
  allowed: PlaygroundParameterKey[]
}

const CONSERVATIVE_PROFILE: ModelParameterProfile = {
  allowed: ['temperature', 'max_tokens'],
}

const OPENAI_PROFILE: ModelParameterProfile = {
  allowed: [
    'temperature',
    'top_p',
    'max_tokens',
    'frequency_penalty',
    'presence_penalty',
    'seed',
  ],
}

const CLAUDE_PROFILE: ModelParameterProfile = {
  allowed: ['temperature', 'max_tokens'],
}

const GEMINI_PROFILE: ModelParameterProfile = {
  allowed: ['temperature', 'max_tokens'],
}

const REASONING_PROFILE: ModelParameterProfile = {
  allowed: [],
}

function normalizeModelName(model: unknown): string {
  return typeof model === 'string' ? model.trim().toLowerCase() : ''
}

export function isReasoningModel(model: unknown): boolean {
  const normalized = normalizeModelName(model)
  return (
    /(^|[-_/])o[134]($|[-_/.])/.test(normalized) ||
    /(^|[-_/])gpt-5($|[-_/.])/.test(normalized) ||
    /(^|[-_/])gpt-oss($|[-_/.])/.test(normalized)
  )
}

export function resolveModelParameterKeys(
  model: unknown
): PlaygroundParameterKey[] {
  const normalized = normalizeModelName(model)

  if (isReasoningModel(normalized)) {
    return [...REASONING_PROFILE.allowed]
  }

  if (
    normalized.includes('claude') ||
    normalized.includes('anthropic') ||
    normalized.includes('claude-code')
  ) {
    return [...CLAUDE_PROFILE.allowed]
  }

  if (normalized.includes('gemini')) {
    return [...GEMINI_PROFILE.allowed]
  }

  if (
    normalized.startsWith('gpt-') ||
    normalized.includes('/gpt-') ||
    normalized.includes('openai/')
  ) {
    return [...OPENAI_PROFILE.allowed]
  }

  return [...CONSERVATIVE_PROFILE.allowed]
}

export function isParameterAllowedForModel(
  model: unknown,
  parameter: PlaygroundParameterKey
): boolean {
  return resolveModelParameterKeys(model).includes(parameter)
}
