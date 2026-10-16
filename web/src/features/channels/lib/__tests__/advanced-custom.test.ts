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

import type { AdvancedCustomConverter } from '../../types'
import {
  getAdvancedCustomConverterDefaults,
  getAdvancedCustomConverterOptions,
  getDefaultAdvancedCustomIncomingPath,
  isAdvancedCustomIncomingPathAllowed,
} from '../advanced-custom'

describe('cross-protocol channel routes', () => {
  it.each([
    [
      'claude_messages_to_gemini_generate_content',
      '/v1/messages',
      '/v1beta/models/{model}:generateContent',
      'key',
    ],
    [
      'gemini_generate_content_to_claude_messages',
      '/v1beta/models/{model}:generateContent',
      '/v1/messages',
      'x-api-key',
    ],
    [
      'openai_responses_to_claude_messages',
      '/v1/responses',
      '/v1/messages',
      'x-api-key',
    ],
  ])(
    '%s exposes the matching route and upstream defaults',
    (value, path, upstream, authName) => {
      const converter = value as AdvancedCustomConverter
      expect(
        getAdvancedCustomConverterOptions(path).map((option) => option.value)
      ).toContain(converter)
      expect(getDefaultAdvancedCustomIncomingPath(converter)).toBe(path)
      expect(
        isAdvancedCustomIncomingPathAllowed('/v1/alpha/search', converter)
      ).toBe(false)
      expect(
        isAdvancedCustomIncomingPathAllowed('/v1/chat/completions', converter)
      ).toBe(false)
      expect(getAdvancedCustomConverterDefaults(converter, path)).toMatchObject(
        {
          upstream_path: upstream,
          auth: { name: authName },
        }
      )
    }
  )
})
