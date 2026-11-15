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
  requestPluginSampleBody,
  requestPluginSampleHasImage,
  requestPluginSamplesFor,
  requestPluginSampleTexts,
} from '../lib/request-plugin-samples'
import type { RequestPluginSample } from '../types'

const sample = (name: string, lang?: string): RequestPluginSample => ({
  name,
  lang,
  format: 'openai',
  body: { messages: [{ role: 'user', content: name }] },
})

const english = sample('English', 'en')
const chinese = sample('Chinese', 'zh')
const anyLanguage = sample('Any language')

describe('the samples shown for the interface language', () => {
  test.each([
    ['zhCN', ['Chinese']],
    ['zhTW', ['Chinese']],
    ['en', ['English']],
  ])(
    'in %s only the samples written in its language show',
    (language, names) => {
      expect(
        requestPluginSamplesFor([english, chinese, anyLanguage], language).map(
          (item) => item.name
        )
      ).toEqual(names)
    }
  )

  test('without samples in the language, those for any language come first, then the English ones', () => {
    expect(
      requestPluginSamplesFor([english, chinese, anyLanguage], 'fr').map(
        (item) => item.name
      )
    ).toEqual(['Any language', 'English'])
  })

  test('a plugin with samples only in other languages offers none', () => {
    expect(requestPluginSamplesFor([chinese], 'ja')).toEqual([])
  })
})

describe('the sample image placeholder', () => {
  const image = 'data:image/png;base64,iVBORw0KGgo='
  const body = (parts: string) => ({
    messages: [
      {
        role: 'user',
        [parts]: [{ type: 'text', text: 'Hi' }, '[sample-image]'],
      },
    ],
  })

  test.each([
    ['openai', { type: 'image_url', image_url: { url: image } }],
    ['openai_responses', { type: 'input_image', image_url: image }],
    [
      'claude',
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: 'iVBORw0KGgo=',
        },
      },
    ],
    ['gemini', { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }],
  ])('in %s becomes an image part of that format', (format, part) => {
    expect(requestPluginSampleBody(body('content'), format, image)).toEqual({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Hi' }, part] },
      ],
    })
  })

  test('is dropped when the browser could not draw the image', () => {
    expect(requestPluginSampleBody(body('parts'), 'gemini', null)).toEqual({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hi' }] }],
    })
  })

  test('asks for the image only as a list item', () => {
    expect(requestPluginSampleHasImage(body('content'))).toBe(true)
    expect(
      requestPluginSampleHasImage({
        prompt: '[sample-image]',
        image: 'data:image/png;base64,AAAA',
      })
    ).toBe(false)
  })

  test('as a text value stays as it is', () => {
    expect(
      requestPluginSampleBody({ prompt: '[sample-image]' }, 'openai', image)
    ).toEqual({ prompt: '[sample-image]' })
  })
})

test('the sample card shows the written texts of a request and leaves out images and settings', () => {
  expect(
    requestPluginSampleTexts({
      model: 'claude-sonnet-4-5',
      system: 'Be brief.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this picture?' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
            },
          ],
        },
      ],
    })
  ).toEqual(['Be brief.', 'What is in this picture?'])
})
