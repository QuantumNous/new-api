import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { PasswordStrengthMeter } from '../password-strength-meter'

describe('PasswordStrengthMeter', () => {
  test('renders nothing while the password is empty', () => {
    const { container } = render(<PasswordStrengthMeter value='' />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  test('exposes the strength via a labelled progressbar', () => {
    render(<PasswordStrengthMeter value='abc123XY' />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '2')
    expect(progressbar).toHaveAttribute('aria-label', 'Password strength')
    expect(progressbar).toHaveAttribute('aria-valuetext', 'Fair password')
  })

  test('shows the label and a hint while below the minimum strength', () => {
    render(<PasswordStrengthMeter value='abcdefgh' />)
    expect(screen.getByText('Weak password')).toBeInTheDocument()
    expect(
      screen.getByText('Use at least 3 of letters, numbers and symbols')
    ).toBeInTheDocument()
  })

  test('hides the hint once the password is strong enough', () => {
    render(<PasswordStrengthMeter value='Abcdef1234!@#$' />)
    expect(screen.getByText('Strong password')).toBeInTheDocument()
    expect(
      screen.queryByText('Use at least 3 of letters, numbers and symbols')
    ).toBeNull()
  })
})
