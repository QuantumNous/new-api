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
import { cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HwPageFrame } from '../authenticated-frame'

// The currency the frame sees; the test flips it the way the store does.
const hwState = vi.hoisted(() => ({ currency: 'TRY' }))

vi.mock('../../hooks/use-hw-currency', () => ({
  useHwCurrency: () => ({ currency: hwState.currency }),
}))

vi.mock('@/components/layout/components/footer', () => ({
  Footer: (props: { variant?: string }) => (
    <footer data-testid='site-footer' data-variant={props.variant} />
  ),
}))

let pageMounts = 0

function Page() {
  useEffect(() => {
    pageMounts += 1
  }, [])
  return <div data-testid='page'>page</div>
}

function renderFrame() {
  return render(<HwPageFrame page={<Page />} />)
}

describe('HwPageFrame', () => {
  beforeEach(() => {
    hwState.currency = 'TRY'
    pageMounts = 0
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the compact site footer below the page', () => {
    renderFrame()

    const footer = screen.getByTestId('site-footer')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveAttribute('data-variant', 'compact')
    expect(screen.getByTestId('page')).toBeInTheDocument()
  })

  it('keeps the page mounted while the currency stays the same', () => {
    const { rerender } = renderFrame()

    rerender(<HwPageFrame page={<Page />} />)

    expect(pageMounts).toBe(1)
  })

  it('remounts the page when the currency changes', () => {
    const { rerender } = renderFrame()
    const before = screen.getByTestId('page')

    hwState.currency = 'EUR'
    rerender(<HwPageFrame page={<Page />} />)

    expect(pageMounts).toBe(2)
    expect(screen.getByTestId('page')).not.toBe(before)
  })
})
