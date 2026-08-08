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
import { splitGeneratedImageMarkdown } from './message-utils'

describe('splitGeneratedImageMarkdown', () => {
  test('separates base64 image markdown from surrounding response text', () => {
    const result = splitGeneratedImageMarkdown(
      'Here is your image:\n\n![astronaut cat](data:image/png;base64,QUJDRA==)'
    )

    expect(result).toEqual({
      text: 'Here is your image:',
      images: [
        {
          alt: 'astronaut cat',
          src: 'data:image/png;base64,QUJDRA==',
        },
      ],
      hasPendingImage: false,
    })
  })

  test('hides an unfinished streamed data image from the Markdown renderer', () => {
    expect(
      splitGeneratedImageMarkdown(
        'Generating your image:\n\n![image](data:image/png;base64,QUJDRA'
      )
    ).toEqual({
      text: 'Generating your image:',
      images: [],
      hasPendingImage: true,
    })
  })
})
