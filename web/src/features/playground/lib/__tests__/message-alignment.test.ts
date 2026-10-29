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
import { expect, it } from 'vitest'

import { getMessageAlignmentClass } from '../message/message-layout-utils'

it('aligns user message text to the inline end, so it follows the bubble in right-to-left pages', () => {
  const classes = getMessageAlignmentClass('right').split(' ')

  expect(classes).toContain('text-end')
  expect(classes).not.toContain('text-right')
})

it('aligns assistant message text to the inline start, so it follows the bubble in right-to-left pages', () => {
  const classes = getMessageAlignmentClass('left').split(' ')

  expect(classes).toContain('text-start')
  expect(classes).not.toContain('text-left')
})
