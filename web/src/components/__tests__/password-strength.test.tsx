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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { accountPasswordSchema } from '@/lib/password-policy'

import { PasswordInput } from '../password-input'
import {
  PasswordConfirmationStatus,
  PasswordStrength,
} from '../password-strength'
import {
  evaluatePasswordStrength,
  getPasswordConfirmationState,
} from '../password-strength-utils'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form'

function ruleMet(password: string, ruleId: string) {
  return evaluatePasswordStrength(password).rules.find(
    (rule) => rule.id === ruleId
  )?.met
}

describe('password length requirement', () => {
  test.each([
    ['7 ASCII characters', 'a'.repeat(7), false],
    ['8 ASCII characters', 'a'.repeat(8), true],
    ['128 ASCII characters', 'a'.repeat(128), true],
    ['129 ASCII characters', 'a'.repeat(129), false],
    ['7 emoji', '🔒'.repeat(7), false],
    ['8 emoji', '🔒'.repeat(8), true],
    ['128 emoji', '🔒'.repeat(128), true],
    ['129 emoji', '🔒'.repeat(129), false],
    ['128 CJK characters', '界'.repeat(128), true],
  ])(
    '%s: meter and submit validation agree on acceptance (%s)',
    (_name, password, accepted) => {
      expect(evaluatePasswordStrength(password).meetsRequirements).toBe(
        accepted
      )
      expect(accountPasswordSchema.safeParse(password).success).toBe(accepted)
    }
  )

  test('counts an emoji as one character, not by UTF-16 units or bytes', () => {
    const result = evaluatePasswordStrength('🔒'.repeat(128))

    expect(result.characterCount).toBe(128)
    expect(result.lengthState).toBe('valid')
  })

  test.each(['alllowercase', 'ALLUPPERCASE', '12345678', 'password123'])(
    'accepts %s even when composition hints are unmet',
    (password) => {
      expect(evaluatePasswordStrength(password).meetsRequirements).toBe(true)
      expect(accountPasswordSchema.safeParse(password).success).toBe(true)
    }
  )
})

describe('password strength score', () => {
  test('keeps an empty password in the empty state', () => {
    const result = evaluatePasswordStrength('')

    expect(result.score).toBe(0)
    expect(result.labelKey).toBe('Password strength empty')
    expect(result.lengthState).toBe('empty')
    expect(result.rules.every((rule) => !rule.met)).toBe(true)
  })

  test('rates a too-short password as weak even with every character type', () => {
    const result = evaluatePasswordStrength('Ab1!')

    expect(result.score).toBe(1)
    expect(result.lengthState).toBe('too-short')
  })

  test.each([
    ['8–11 characters of one kind', 'moonlight', 'Password strength weak'],
    ['8–11 characters of two kinds', 'Moonlight', 'Password strength fair'],
    ['8 characters of every kind', 'Aa1!aaab', 'Password strength fair'],
    ['12–14 characters of one kind', 'alllowercase', 'Password strength fair'],
    [
      '12–14 characters of three kinds',
      'Forest7!Lake',
      'Password strength good',
    ],
    [
      '15–19 characters of one kind',
      'moonlightharbor',
      'Password strength good',
    ],
    [
      '15+ characters of two kinds',
      'xK9#q2345Lm!vT7pRz',
      'Password strength strong',
    ],
    [
      'a 20+ character lowercase passphrase',
      'correct horse battery staple',
      'Password strength strong',
    ],
    [
      'a 20+ character mixed passphrase',
      'Property-Garden-Lamp-River',
      'Password strength strong',
    ],
  ])('rates %s (%s) by length first: %s', (_name, password, label) => {
    const result = evaluatePasswordStrength(password)

    expect(result.guessable).toBe(false)
    expect(result.labelKey).toBe(label)
  })

  test.each([
    ['a common password', 'password', true],
    ['a common password with a digit suffix', 'password123', true],
    ['a capitalised common password with a suffix', 'Password123!', true],
    ['a keyboard word with a year', 'qwerty2024', true],
    ['a short common password with a symbol', 'admin!', false],
    ['one repeated character', 'aaaaaaaa', true],
    ['16 repeated characters', 'aaaaaaaaaaaaaaaa', true],
    ['an ascending digit run', '12345678', true],
    ['a wrapping 16-digit run', '1234567890123456', true],
    ['a descending digit run', '87654321', true],
    ['an alphabet run', 'abcdefgh', true],
    ['a keyboard row run', 'qwertyui', true],
  ])(
    'rates %s (%s) as weak and easy to guess; accepted by length: %s',
    (_name, password, accepted) => {
      const result = evaluatePasswordStrength(password)

      expect(result.guessable).toBe(true)
      expect(result.labelKey).toBe('Password strength weak')
      expect(result.meetsRequirements).toBe(accepted)
      expect(accountPasswordSchema.safeParse(password).success).toBe(accepted)
    }
  )

  test.each([
    ['a common word as a prefix', 'administrator forest lake 2026'],
    ['a keyboard run inside a word', 'Property-Garden-Lamp-River'],
    ['a keyboard run inside a passphrase', 'liberty bell harbor stone'],
    ['a common word inside a passphrase', 'Dragonfly-Meadow-Quiet-91'],
    ['a digit run inside random characters', 'xK9#q2345Lm!vT7pRz'],
    ['a digit run after a word', 'Forest1234!'],
    ['an alphabet run before a word', 'Abcd7!forest'],
    ['repeated characters before a word', 'AAAA7!forest'],
  ])('does not flag %s (%s) as easy to guess', (_name, password) => {
    expect(evaluatePasswordStrength(password).guessable).toBe(false)
  })

  test('does not treat Unicode letters as symbols', () => {
    expect(ruleMet('Abcdef1é', 'symbol')).toBe(false)
    expect(ruleMet('密码Abcdef1', 'symbol')).toBe(false)
  })
})

describe('password confirmation state', () => {
  test('waits for confirmation input before reporting a state', () => {
    expect(getPasswordConfirmationState('Forest7!Lake', '')).toBe('empty')
  })

  test('reports a mismatch when the confirmation differs by one character', () => {
    expect(getPasswordConfirmationState('Forest7!Lake', 'Forest7!Lakes')).toBe(
      'mismatch'
    )
  })

  test('reports a match only for the exact same password', () => {
    expect(getPasswordConfirmationState('Forest7!Lake', 'Forest7!Lake')).toBe(
      'match'
    )
    expect(getPasswordConfirmationState('Forest7!Lake', 'forest7!lake')).toBe(
      'mismatch'
    )
  })
})

describe('password strength feedback', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows the 8–128 character requirement in the empty state without an error', () => {
    render(<PasswordStrength value='' />)

    expect(
      screen.queryByText('Password requirements not met')
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('8–128 characters')).toHaveLength(2)
    expect(
      screen.getByRole('meter', { name: 'Password strength' })
    ).toHaveAttribute('aria-valuenow', '0')
  })

  test('shows how many characters a short password still needs', () => {
    render(<PasswordStrength value='Ab1!' />)

    expect(screen.getByText('Characters needed: 4')).toBeInTheDocument()
    expect(
      screen.getByText('Password requirements not met')
    ).toBeInTheDocument()
  })

  test('shows how far a 129-character password is over the limit', () => {
    render(<PasswordStrength value={'a'.repeat(129)} />)

    expect(screen.getByText('Characters over limit: 1')).toBeInTheDocument()
    expect(
      screen.getByText('Password requirements not met')
    ).toBeInTheDocument()
  })

  test('marks a lowercase-only password as meeting the requirement and lists hints separately', () => {
    const rendered = render(
      <PasswordStrength id='password-strength-help' value='alllowercase' />
    )

    const feedback = rendered.container.querySelector('#password-strength-help')
    expect(feedback).toHaveTextContent('Password requirements met')
    expect(feedback).toHaveTextContent('For a stronger password')
    expect(feedback).toHaveTextContent('15 or more characters')
    expect(feedback).toHaveTextContent('Uppercase and lowercase letters')
  })

  test('announces strength once typing settles and keeps hints as suggestions', () => {
    vi.useFakeTimers()
    render(<PasswordStrength value='alllowercase' />)

    act(() => {
      vi.advanceTimersByTime(700)
    })

    const announcement = screen.getByText(/^Password strength: /)
    expect(announcement).toHaveAttribute('aria-live', 'polite')
    expect(announcement).toHaveTextContent('Password requirements met')
    expect(announcement).toHaveTextContent('Suggestions remaining:')
  })

  test('keeps an optional update password quiet while empty', () => {
    const rendered = render(
      <PasswordStrength id='password-strength-help' value='' quietWhenEmpty />
    )

    expect(rendered.container).toBeEmptyDOMElement()
  })

  test('keeps a stable confirmation status region before input', () => {
    render(
      <PasswordConfirmationStatus password='Forest7!Lake' confirmation='' />
    )

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  test('announces a confirmation mismatch', () => {
    render(
      <PasswordConfirmationStatus
        password='Forest7!Lake'
        confirmation='Forest7!Lakes'
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Passwords do not match'
    )
  })

  test('announces a matching confirmation', () => {
    render(
      <PasswordConfirmationStatus
        password='Forest7!Lake'
        confirmation='Forest7!Lake'
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Passwords match')
  })

  test('describes the input with strength help and the validation error after a failed submit', async () => {
    function PasswordFieldFixture() {
      const form = useForm({ defaultValues: { password: '' } })

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(() => undefined)}>
            <FormField
              control={form.control}
              name='password'
              rules={{ required: 'Password is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl describedBy='password-strength-help'>
                    <PasswordInput {...field} />
                  </FormControl>
                  <PasswordStrength
                    id='password-strength-help'
                    value={field.value}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <button type='submit'>Submit</button>
          </form>
        </Form>
      )
    }

    const user = userEvent.setup()
    render(<PasswordFieldFixture />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(
      'password-strength-help'
    )

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? []
    const error = screen.getByText('Password is required')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy).toContain('password-strength-help')
    expect(describedBy).toContain(error.id)
  })
})
