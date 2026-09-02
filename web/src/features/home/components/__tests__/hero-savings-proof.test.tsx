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
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Hero } from '../sections/hero'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; className?: string; to: string }) => (
    <a className={props.className} href={props.to}>
      {props.children}
    </a>
  ),
}))

describe('hero savings proof', () => {
  it('shows a readable positive saving and an honest relative price index', () => {
    render(<Hero maxSavingsPercent={87} />)

    const proof = screen.getByTestId('hero-savings-proof')
    expect(within(proof).getByText('Best current saving')).toBeVisible()
    expect(proof.querySelector('[aria-live="polite"]')).toHaveTextContent('87%')
    expect(within(proof).queryByText('-87%')).not.toBeInTheDocument()
    expect(within(proof).getByText('Official API price index')).toBeVisible()
    expect(within(proof).getByText('Yecai price index')).toBeVisible()
    expect(within(proof).getByText('13')).toBeVisible()
    expect(
      within(proof).getByRole('button', { name: 'Calculate with my usage' })
    ).toHaveAttribute('href', '#savings-calculator')
    expect(
      within(proof).getByRole('img', { name: 'Setup guide' })
    ).toHaveAttribute('src', expect.stringContaining('cai-cai-guide-v1.png'))
  })

  it('follows the pointer with bounded scene variables and resets on leave', () => {
    render(<Hero maxSavingsPercent={65} />)

    const proof = screen.getByTestId('hero-savings-proof')
    vi.spyOn(proof, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerMove(proof, { clientX: 150, clientY: 25 })

    expect(proof.style.getPropertyValue('--market-pointer-x')).toBe('0.250')
    expect(proof.style.getPropertyValue('--market-pointer-y')).toBe('-0.250')

    fireEvent.pointerLeave(proof)

    expect(proof.style.getPropertyValue('--market-pointer-x')).toBe('0')
    expect(proof.style.getPropertyValue('--market-pointer-y')).toBe('0')
  })
})
