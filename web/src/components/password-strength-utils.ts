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
const LOWERCASE_PATTERN = /\p{Ll}/u
const UPPERCASE_PATTERN = /\p{Lu}/u
const DIGIT_PATTERN = /\p{N}/u
const SYMBOL_PATTERN = /[\p{P}\p{S}]/u

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 20
export const PASSWORD_MAX_BYTES = 72

export type PasswordStrengthRuleId = 'length' | 'case' | 'digit' | 'symbol'
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4
export type PasswordStrengthLabel =
  | 'Password strength empty'
  | 'Password strength weak'
  | 'Password strength fair'
  | 'Password strength good'
  | 'Password strength strong'
export type PasswordConfirmationState = 'empty' | 'match' | 'mismatch'
export type PasswordLengthState =
  | 'empty'
  | 'too-short'
  | 'valid'
  | 'too-long'
  | 'too-many-bytes'
export type PasswordValidationMessageKey =
  | 'Password must be between 8 and 20 characters'
  | 'Password contains too many emoji or extended characters'

type EvaluatedPasswordRule = {
  id: PasswordStrengthRuleId
  met: boolean
}

export type PasswordStrengthResult = {
  score: PasswordStrengthScore
  labelKey: PasswordStrengthLabel
  guessable: boolean
  meetsRequirements: boolean
  characterCount: number
  lengthState: PasswordLengthState
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
  const characterCount = [...password].length
  const byteCount = new TextEncoder().encode(password).length
  let lengthState: PasswordLengthState = 'valid'
  if (characterCount === 0) {
    lengthState = 'empty'
  } else if (characterCount < PASSWORD_MIN_LENGTH) {
    lengthState = 'too-short'
  } else if (characterCount > PASSWORD_MAX_LENGTH) {
    lengthState = 'too-long'
  } else if (byteCount > PASSWORD_MAX_BYTES) {
    lengthState = 'too-many-bytes'
  }
  const meetsRequirements = lengthState === 'valid'
  const rules: EvaluatedPasswordRule[] = [
    {
      id: 'length',
      met: meetsRequirements,
    },
    {
      id: 'case',
      met: LOWERCASE_PATTERN.test(password) && UPPERCASE_PATTERN.test(password),
    },
    { id: 'digit', met: DIGIT_PATTERN.test(password) },
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
    characterCount,
    lengthState,
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

export function getPasswordValidationMessageKey(
  password: string
): PasswordValidationMessageKey | null {
  if (!password) return 'Password must be between 8 and 20 characters'

  const result = evaluatePasswordStrength(password)
  if (result.lengthState === 'too-many-bytes') {
    return 'Password contains too many emoji or extended characters'
  }
  if (!result.meetsRequirements) {
    return 'Password must be between 8 and 20 characters'
  }
  return null
}
