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
import { describe, expect, it } from 'vitest'

import { CinematicPromise } from '../sections/cinematic-promise'

describe('cinematic promise', () => {
  it('keeps the full-screen motion scene grounded in beginner benefits', () => {
    const { container } = render(<CinematicPromise />)

    expect(container.querySelector('[data-section="PROMISE"]')).toBeTruthy()
    expect(
      screen.getByText(
        'The same powerful experience, without the high monthly cost'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('True pay-as-you-go: pay only for what you use')
    ).toBeVisible()
    expect(
      screen.getByText('Fully compatible with 30+ popular everyday tools')
    ).toBeVisible()
  })
})
