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
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { FailReasonDialog } from '../dialogs/fail-reason-dialog'
import { PromptDialog } from '../dialogs/prompt-dialog'

it('pins the prompt copy button to the inline end, away from the start of right-to-left text', () => {
  render(
    <div dir='rtl'>
      <PromptDialog prompt='یک گربه' open onOpenChange={() => {}} />
    </div>
  )

  const copy = screen.getByTitle('Copy to clipboard')
  expect(copy).toHaveClass('end-2')
  expect(copy).not.toHaveClass('right-2')
  expect(screen.getByText('یک گربه')).toHaveClass('pe-10')
})

it('pins the fail reason copy button to the inline end, away from the start of right-to-left text', () => {
  render(
    <div dir='rtl'>
      <FailReasonDialog failReason='خطا' open onOpenChange={() => {}} />
    </div>
  )

  const copy = screen.getByTitle('Copy to clipboard')
  expect(copy).toHaveClass('end-2')
  expect(copy).not.toHaveClass('right-2')
  expect(screen.getByText('خطا')).toHaveClass('pe-10')
})
