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

import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import {
  evaluatePasswordStrength,
  getPasswordConfirmationState,
} from '../password-strength-utils'

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

const { PasswordStrength } = await import('../password-strength')

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

  test('keeps an optional update password quiet while empty', () => {
    const rendered = render(
      <PasswordStrength id='password-strength-help' value='' quietWhenEmpty />
    )

    expect(rendered.container).toBeEmptyDOMElement()
  })
})
