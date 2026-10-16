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
import { expect, test, vi } from 'vitest'

import { ImageSettingInput } from '../image-setting-input'

test.each(['Logo', 'QR code image'])(
  '%s upload preview stays compact without cropping',
  (label) => {
    render(
      <ImageSettingInput
        label={label}
        value='https://example.com/image.png'
        onChange={vi.fn()}
      />
    )
    expect(screen.getByRole('img', { name: label })).toHaveClass(
      'size-10',
      'shrink-0',
      'object-contain'
    )
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled()
  }
)
