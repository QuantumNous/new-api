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
const COMMON_PASSWORD_PATTERN =
  /^(?:password|passw0rd|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|abc123|111111|123123|123456)/i
const REPEATED_CHARACTER_PATTERN = /(.)\1{3,}/
const SEQUENTIAL_PATTERN =
  /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|qwer|wert|erty|asdf)/i
const SYMBOL_PATTERN = /[^a-zA-Z0-9]/

export type PasswordStrengthRuleId = 'length' | 'case' | 'digit' | 'symbol'
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4
export type PasswordStrengthLabel =
  | 'Password strength empty'
  | 'Password strength weak'
  | 'Password strength fair'
  | 'Password strength good'
  | 'Password strength strong'
export type PasswordConfirmationState = 'empty' | 'match' | 'mismatch'

type EvaluatedPasswordRule = {
  id: PasswordStrengthRuleId
  met: boolean
}

export type PasswordStrengthResult = {
  score: PasswordStrengthScore
  labelKey: PasswordStrengthLabel
  guessable: boolean
  meetsRequirements: boolean
  rules: EvaluatedPasswordRule[]
}

const STRENGTH_LABELS: Record<PasswordStrengthScore, PasswordStrengthLabel> = {
  0: 'Password strength empty',
  1: 'Password strength weak',
  2: 'Password strength fair',
  3: 'Password strength good',
  4: 'Password strength strong',
}

function getPasswordScore(
  hasValue: boolean,
  passedRules: number,
  guessable: boolean
): PasswordStrengthScore {
  if (!hasValue) return 0
  if (guessable || passedRules <= 1) return 1
  if (passedRules === 2) return 2
  if (passedRules === 3) return 3
  return 4
}

export function evaluatePasswordStrength(
  password: string
): PasswordStrengthResult {
  const meetsRequirements = password.length >= 8 && password.length <= 20
  const rules: EvaluatedPasswordRule[] = [
    {
      id: 'length',
      met: meetsRequirements,
    },
    {
      id: 'case',
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { id: 'digit', met: /\d/.test(password) },
    { id: 'symbol', met: SYMBOL_PATTERN.test(password) },
  ]
  const guessable =
    password.length > 0 &&
    (COMMON_PASSWORD_PATTERN.test(password) ||
      REPEATED_CHARACTER_PATTERN.test(password) ||
      SEQUENTIAL_PATTERN.test(password))
  const passedRules = rules.reduce(
    (count, rule) => count + (rule.met ? 1 : 0),
    0
  )
  const score = getPasswordScore(password.length > 0, passedRules, guessable)

  return {
    score,
    labelKey: STRENGTH_LABELS[score],
    guessable,
    meetsRequirements,
    rules,
  }
}

export function getPasswordConfirmationState(
  password: string,
  confirmation: string
): PasswordConfirmationState {
  if (!confirmation) return 'empty'
  return password === confirmation ? 'match' : 'mismatch'
}
