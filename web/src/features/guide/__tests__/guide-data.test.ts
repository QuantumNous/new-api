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
  getGuideDoc,
  getGuideNeighbors,
  getGuideSearchText,
  guideDocs,
} from '../catalog'
import { fillGuideTemplate, filterModelsForAudience } from '../lib/runtime'
import type { GuideRuntime } from '../types'

const runtime: GuideRuntime = {
  host: 'https://api.example.test',
  baseUrl: 'https://api.example.test/v1',
  fullUrl: 'https://api.example.test/v1/chat/completions',
  model: 'model-a',
  group: 'default',
  platform: 'macos',
  verified: true,
}

describe('developer guide catalog', () => {
  it('exposes the seven approved articles in navigation order', () => {
    expect(guideDocs.map((doc) => doc.slug)).toEqual([
      'quick-start',
      'essentials',
      'claude-code',
      'codex',
      'cc-switch',
      'cherry-studio',
      'troubleshooting',
    ])
  })

  it('returns stable neighbors for article navigation', () => {
    expect(getGuideNeighbors('codex')).toMatchObject({
      previous: { slug: 'claude-code' },
      next: { slug: 'cc-switch' },
    })
    expect(getGuideNeighbors('quick-start').previous).toBeNull()
    expect(getGuideNeighbors('troubleshooting').next).toBeNull()
  })

  it('does not resolve an unknown article slug', () => {
    expect(getGuideDoc('missing')).toBeUndefined()
  })

  it('chooses a model and group before creating the key that owns that route', () => {
    const quickStart = getGuideDoc('quick-start')
    const steps = quickStart?.sections
      .find((section) => section.id === 'connect')
      ?.blocks.find((block) => block.type === 'steps')

    expect(steps?.type).toBe('steps')
    if (steps?.type !== 'steps') return
    expect(steps.items.map((item) => item.title)).toEqual([
      'Choose a model and group',
      'Create an API key',
      'Send a minimal request',
    ])
  })

  it('does not describe the billing group as a client request field', () => {
    const visibleGuideText = guideDocs
      .map((doc) => getGuideSearchText(doc, (key) => key))
      .join(' ')

    expect(visibleGuideText).not.toContain('client exposes a group')
    expect(visibleGuideText).not.toContain('custom-header field')
  })
})

describe('developer guide runtime', () => {
  it('fills deployment, selection, and masked-key placeholders', () => {
    expect(
      fillGuideTemplate(
        '{{HOST}} {{BASE_URL}} {{FULL_URL}} {{MODEL}} {{GROUP}} {{API_KEY_PLACEHOLDER}}',
        runtime
      )
    ).toBe(
      'https://api.example.test https://api.example.test/v1 https://api.example.test/v1/chat/completions model-a default sk-••••••'
    )
  })

  it('leaves unknown placeholders visible instead of erasing content', () => {
    expect(fillGuideTemplate('{{UNKNOWN}}', runtime)).toBe('{{UNKNOWN}}')
  })

  it('filters account models by the selected protocol without mutating input order', () => {
    const accountModels = ['missing-metadata', 'chat', 'agent']
    const pricing = [
      { model_name: 'chat', supported_endpoint_types: ['openai'] },
      {
        model_name: 'agent',
        supported_endpoint_types: ['openai-response'],
      },
    ]

    expect(
      filterModelsForAudience(accountModels, pricing, 'openai-response')
    ).toEqual(['agent'])
    expect(accountModels).toEqual(['missing-metadata', 'chat', 'agent'])
  })

  it('keeps every account model for protocol-neutral articles', () => {
    expect(filterModelsForAudience(['zeta', 'alpha'], [], 'all')).toEqual([
      'alpha',
      'zeta',
    ])
  })
})
