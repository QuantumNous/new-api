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
import assert from 'node:assert/strict'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, test } from 'vitest'

import { PasswordInput } from '../password-input'
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

describe('password strength evaluation', () => {
  test('keeps an empty password in the empty state', () => {
    const result = evaluatePasswordStrength('')

    assert.equal(result.score, 0)
    assert.equal(result.labelKey, 'Password strength empty')
    assert.equal(result.guessable, false)
    assert.equal(result.meetsRequirements, false)
    assert.deepEqual(
      result.rules.map((rule) => [rule.id, rule.met]),
      [
        ['length', false],
        ['case', false],
        ['digit', false],
        ['symbol', false],
      ]
    )
  })

  test('treats the existing 8 and 20 character limits as the length rule', () => {
    assert.equal(evaluatePasswordStrength('Abcde1!x').rules[0]?.met, true)
    assert.equal(
      evaluatePasswordStrength('Abcdefghijklmno1!xyz').rules[0]?.met,
      true
    )
    assert.equal(evaluatePasswordStrength('Abcde1!').rules[0]?.met, false)
    assert.equal(
      evaluatePasswordStrength('Abcdefghijklmno1!xyzz').rules[0]?.met,
      false
    )
  })

  test('counts Unicode code points consistently for the length requirement', () => {
    assert.equal(evaluatePasswordStrength('😀'.repeat(7)).rules[0]?.met, false)
    assert.equal(evaluatePasswordStrength('😀'.repeat(8)).rules[0]?.met, true)
  })

  test('rejects passwords that exceed the bcrypt byte limit', () => {
    const result = evaluatePasswordStrength('😀'.repeat(20))

    assert.equal(result.meetsRequirements, false)
    assert.equal(result.lengthState, 'too-many-bytes')
  })

  test('does not treat Unicode letters as symbols', () => {
    assert.equal(
      evaluatePasswordStrength('Abcdef1é').rules.find(
        (rule) => rule.id === 'symbol'
      )?.met,
      false
    )
    assert.equal(
      evaluatePasswordStrength('密码Abcdef1').rules.find(
        (rule) => rule.id === 'symbol'
      )?.met,
      false
    )
  })

  test('evaluates mixed case, number, and symbol guidance independently', () => {
    const result = evaluatePasswordStrength('mixedcase')

    assert.deepEqual(
      result.rules.map((rule) => [rule.id, rule.met]),
      [
        ['length', true],
        ['case', false],
        ['digit', false],
        ['symbol', false],
      ]
    )
    assert.equal(result.score, 1)
    assert.equal(result.labelKey, 'Password strength weak')
    assert.equal(result.meetsRequirements, true)
  })

  test('keeps requirement compliance independent from strength suggestions', () => {
    assert.equal(
      evaluatePasswordStrength('alllowercase').meetsRequirements,
      true
    )
    assert.equal(evaluatePasswordStrength('Short1!').meetsRequirements, false)
    assert.equal(
      evaluatePasswordStrength('Abcdefghijklmno1!xyzz').meetsRequirements,
      false
    )
  })

  test('reports a password that meets all guidance as strong', () => {
    const result = evaluatePasswordStrength('Forest7!Lake')

    assert.equal(result.score, 4)
    assert.equal(result.labelKey, 'Password strength strong')
    assert.equal(result.guessable, false)
    assert.equal(
      result.rules.every((rule) => rule.met),
      true
    )
  })

  test('downgrades commonly guessed passwords without changing their rules', () => {
    const result = evaluatePasswordStrength('Password1!')

    assert.equal(
      result.rules.every((rule) => rule.met),
      true
    )
    assert.equal(result.guessable, true)
    assert.equal(result.score, 1)
    assert.equal(result.labelKey, 'Password strength weak')
  })

  test('downgrades repeated and sequential patterns', () => {
    assert.equal(evaluatePasswordStrength('AAAA7!forest').guessable, true)
    assert.equal(evaluatePasswordStrength('Abcd7!forest').guessable, true)
    assert.equal(evaluatePasswordStrength('Forest1234!').guessable, true)
  })
})

describe('password confirmation state', () => {
  test('waits for confirmation input before reporting a state', () => {
    assert.equal(getPasswordConfirmationState('Forest7!Lake', ''), 'empty')
  })

  test('reports matching and mismatching confirmations', () => {
    assert.equal(
      getPasswordConfirmationState('Forest7!Lake', 'Forest7!Lake'),
      'match'
    )
    assert.equal(
      getPasswordConfirmationState('Forest7!Lake', 'Forest7!Lakes'),
      'mismatch'
    )
  })
})

const { PasswordConfirmationStatus, PasswordStrength } =
  await import('../password-strength')

describe('password strength feedback', () => {
  test('exposes requirement feedback through its caller-provided id', () => {
    const rendered = render(
      <PasswordStrength id='password-strength-help' value='alllowercase' />
    )

    const feedback = rendered.container.querySelector('#password-strength-help')
    expect(feedback).toBeInTheDocument()
    expect(feedback).toHaveTextContent('Password requirements met')
    expect(feedback).toHaveTextContent('For a stronger password')
  })

  test('explains the remaining character count for a short password', () => {
    render(<PasswordStrength value='Ab1!' />)

    expect(screen.getByText('Characters remaining: 4')).toBeInTheDocument()
  })

  test('keeps the initial empty state neutral', () => {
    render(<PasswordStrength value='' />)

    expect(
      screen.queryByText('Password requirements not met')
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('8–20 characters')).toHaveLength(2)
  })

  test('keeps an optional update password quiet while empty', () => {
    const rendered = render(
      <PasswordStrength id='password-strength-help' value='' quietWhenEmpty />
    )

    expect(rendered.container).toBeEmptyDOMElement()
  })

  test('keeps a stable confirmation status region before input', () => {
    render(
      <PasswordConfirmationStatus
        id='password-confirmation-status'
        password='Forest7!Lake'
        confirmation=''
      />
    )

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  test('keeps strength help and validation errors associated with the input', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const input = screen.getByLabelText('Password')
    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? []
    const error = screen.getByText('Password is required')

    expect(describedBy).toContain('password-strength-help')
    expect(describedBy).toContain(error.id)
  })
})
