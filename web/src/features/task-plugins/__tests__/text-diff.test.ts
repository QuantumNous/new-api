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
import { expect, test } from 'vitest'

import { diffText } from '../lib/text-diff'

test('an address or number replaced in a sentence shows as one change', () => {
  expect(
    diffText('Email alex@example.com today', 'Email [REDACTED] today')
  ).toEqual([
    { kind: 'same', text: 'Email ' },
    { kind: 'removed', text: 'alex@example.com' },
    { kind: 'added', text: '[REDACTED]' },
    { kind: 'same', text: ' today' },
  ])
})

test('Chinese text is compared one character at a time', () => {
  expect(diffText('手机 138 1234 5678，谢谢', '手机 [电话]，谢谢')).toEqual([
    { kind: 'same', text: '手机 ' },
    { kind: 'removed', text: '138 1234 5678' },
    { kind: 'added', text: '[电话]' },
    { kind: 'same', text: '，谢谢' },
  ])
})

test('texts too long to compare are left to show as they are', () => {
  expect(diffText('a '.repeat(1001), 'b')).toBeNull()
  expect(diffText('same', 'same')).toEqual([{ kind: 'same', text: 'same' }])
})

test('a masked address before a full stop marks the address and the mask alone', () => {
  expect(diffText('Write to alex@example.com.', 'Write to ***.')).toEqual([
    { kind: 'same', text: 'Write to ' },
    { kind: 'removed', text: 'alex@example.com' },
    { kind: 'added', text: '***' },
    { kind: 'same', text: '.' },
  ])
})
