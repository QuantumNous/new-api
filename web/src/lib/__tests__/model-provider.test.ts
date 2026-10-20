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

import { resolveModelProvider } from '../model-provider'

describe('resolveModelProvider', () => {
  it('maps the Cloudflare clef family', () => {
    for (const model of [
      'clef',
      'clef:27b',
      'clef:latest',
      'clef:cloud',
      'clef:27b-cloud',
    ]) {
      expect(resolveModelProvider(model)).toMatchObject({
        name: 'Cloudflare',
        icon: 'Cloudflare.Color',
      })
    }
  })

  it('maps NVIDIA families that do not carry the nvidia prefix', () => {
    for (const model of [
      'nv-embed-v1',
      'nv-rerankqa-mistral-4b-v3',
      'riva-translate-4b-instruct-v2',
      'parakeet-tdt-0.6b-v2',
      'canary-1b-v2',
      'nemoretriever-parse',
    ]) {
      expect(resolveModelProvider(model)).toMatchObject({
        name: 'NVIDIA',
        icon: 'Nvidia.Color',
      })
    }
  })

  it('keeps existing matches', () => {
    expect(resolveModelProvider('deepseek-chat')).toMatchObject({
      name: 'DeepSeek',
    })
    expect(resolveModelProvider('gpt-4o')).toMatchObject({ name: 'OpenAI' })
    expect(resolveModelProvider('glm-5.3')).toMatchObject({ name: 'Zhipu' })
    expect(resolveModelProvider('nvidia/llama-3.3-70b-instruct')).toMatchObject(
      { name: 'NVIDIA' }
    )
  })

  it('returns null for unknown models', () => {
    expect(resolveModelProvider('totally-unknown-model')).toBeNull()
  })
})
