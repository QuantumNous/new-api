/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/

// Coverage: DateRangeControl — preset rendering, active state, onChange, disabled custom

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangeControl } from '../components/date-range-control'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Minimal Button shim — enough for active/disabled checks
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      {...rest}
    >
      {children}
    </button>
  ),
}))

describe('DateRangeControl', () => {
  it('renders all three preset labels', () => {
    render(<DateRangeControl value='7d' onChange={vi.fn()} />)
    expect(screen.getByText('Last 24 hours')).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('renders a disabled Custom range button', () => {
    render(<DateRangeControl value='7d' onChange={vi.fn()} />)
    const customBtn = screen.getByText('Custom range')
    expect(customBtn.closest('button')).toBeDisabled()
  })

  it('active preset button shows variant="default"', () => {
    render(<DateRangeControl value='7d' onChange={vi.fn()} />)
    const btn = screen.getByText('Last 7 days').closest('button')
    expect(btn).toHaveAttribute('data-variant', 'default')
  })

  it('inactive preset buttons show variant="outline"', () => {
    render(<DateRangeControl value='7d' onChange={vi.fn()} />)
    const btn24h = screen.getByText('Last 24 hours').closest('button')
    const btn30d = screen.getByText('Last 30 days').closest('button')
    expect(btn24h).toHaveAttribute('data-variant', 'outline')
    expect(btn30d).toHaveAttribute('data-variant', 'outline')
  })

  it('calls onChange("24h") when 24h button is clicked', async () => {
    const onChange = vi.fn()
    render(<DateRangeControl value='7d' onChange={onChange} />)
    await userEvent.click(screen.getByText('Last 24 hours'))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('24h')
  })

  it('calls onChange("30d") when 30d button is clicked', async () => {
    const onChange = vi.fn()
    render(<DateRangeControl value='7d' onChange={onChange} />)
    await userEvent.click(screen.getByText('Last 30 days'))
    expect(onChange).toHaveBeenCalledWith('30d')
  })

  it('clicking disabled Custom range does not call onChange', async () => {
    const onChange = vi.fn()
    render(<DateRangeControl value='7d' onChange={onChange} />)
    const customBtn = screen.getByText('Custom range').closest('button')!
    await userEvent.click(customBtn)
    expect(onChange).not.toHaveBeenCalled()
  })
})
