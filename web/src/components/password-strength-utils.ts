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
import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  countPasswordCharacters,
} from '@/lib/password-policy'

// A password is only guessable as a whole: one of these, ignoring case, with
// nothing after it but digits, symbols or spaces. 'Password123!' matches;
// 'administrator forest lake' does not.
const COMMON_PASSWORDS = [
  'password',
  'passw0rd',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  'iloveyou',
  'monkey',
  'dragon',
  'abc123',
  '111111',
  '123123',
  '123456',
]
const COMMON_PASSWORD_SUFFIX_PATTERN = /^[\p{N}\p{P}\p{S}\s]*$/u
// Character runs people type in order; a password that steps through one of
// them in a single direction (wrapping, as in '1234567890123') is a guess.
const STRAIGHT_RUNS = [
  '0123456789',
  'abcdefghijklmnopqrstuvwxyz',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
]
const LOWERCASE_PATTERN = /\p{Ll}/u
const UPPERCASE_PATTERN = /\p{Lu}/u
const DIGIT_PATTERN = /\p{N}/u
const SYMBOL_PATTERN = /[\p{P}\p{S}]/u

// Only the account length policy decides whether a password is accepted.
// The other rules are strength hints and never block a password.
export const PASSWORD_RECOMMENDED_LENGTH = 15
const PASSWORD_GOOD_LENGTH = 12
const PASSPHRASE_LENGTH = 20

export type PasswordStrengthRuleId =
  | 'length'
  | 'long'
  | 'case'
  | 'digit'
  | 'symbol'
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4
export type PasswordStrengthLabel =
  | 'Password strength empty'
  | 'Password strength weak'
  | 'Password strength fair'
  | 'Password strength good'
  | 'Password strength strong'
export type PasswordConfirmationState = 'empty' | 'match' | 'mismatch'
export type PasswordLengthState = 'empty' | 'too-short' | 'valid' | 'too-long'

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

// Only a guess when the whole password is one: a common password with a
// suffix, one repeated character, or one straight run. Common words or runs
// inside a longer password do not count.
function isGuessablePassword(password: string): boolean {
  const lowercase = password.toLowerCase()
  const isCommon = COMMON_PASSWORDS.some(
    (common) =>
      lowercase.startsWith(common) &&
      COMMON_PASSWORD_SUFFIX_PATTERN.test(lowercase.slice(common.length))
  )
  if (isCommon) return true
  const characters = [...lowercase]
  // Below four characters nearly every start of a word is a run or a repeat.
  if (characters.length < 4) return false
  if (characters.every((character) => character === characters[0])) {
    return true
  }

  for (const run of STRAIGHT_RUNS) {
    const positions = characters.map((character) => run.indexOf(character))
    if (positions.includes(-1)) continue
    for (const step of [1, run.length - 1]) {
      const straight = positions.every(
        (position, index) =>
          index === 0 || position === (positions[index - 1] + step) % run.length
      )
      if (straight) return true
    }
  }
  return false
}

// Length decides most of the score (OWASP ASVS 5.0 6.2.1 recommends 15+
// characters); mixing character kinds only helps shorter passwords.
function getPasswordScore(
  characterCount: number,
  acceptable: boolean,
  variety: number
): PasswordStrengthScore {
  if (characterCount === 0) return 0
  if (!acceptable) return 1
  if (characterCount < PASSWORD_GOOD_LENGTH) return variety >= 2 ? 2 : 1
  if (characterCount < PASSWORD_RECOMMENDED_LENGTH) {
    return variety >= 3 ? 3 : 2
  }
  return characterCount >= PASSPHRASE_LENGTH || variety >= 2 ? 4 : 3
}

export function evaluatePasswordStrength(
  password: string
): PasswordStrengthResult {
  const characterCount = countPasswordCharacters(password)
  let lengthState: PasswordLengthState = 'valid'
  if (characterCount === 0) {
    lengthState = 'empty'
  } else if (characterCount < ACCOUNT_PASSWORD_MIN_LENGTH) {
    lengthState = 'too-short'
  } else if (characterCount > ACCOUNT_PASSWORD_MAX_LENGTH) {
    lengthState = 'too-long'
  }
  const meetsRequirements = lengthState === 'valid'
  const hasLowercase = LOWERCASE_PATTERN.test(password)
  const hasUppercase = UPPERCASE_PATTERN.test(password)
  const hasDigit = DIGIT_PATTERN.test(password)
  const hasSymbol = SYMBOL_PATTERN.test(password)
  const variety = [hasLowercase, hasUppercase, hasDigit, hasSymbol].filter(
    Boolean
  ).length
  const guessable = isGuessablePassword(password)
  const score = getPasswordScore(
    characterCount,
    meetsRequirements && !guessable,
    variety
  )

  return {
    score,
    labelKey: STRENGTH_LABELS[score],
    guessable,
    meetsRequirements,
    characterCount,
    lengthState,
    rules: [
      { id: 'length', met: meetsRequirements },
      { id: 'long', met: characterCount >= PASSWORD_RECOMMENDED_LENGTH },
      { id: 'case', met: hasLowercase && hasUppercase },
      { id: 'digit', met: hasDigit },
      { id: 'symbol', met: hasSymbol },
    ],
  }
}

export function getPasswordConfirmationState(
  password: string,
  confirmation: string
): PasswordConfirmationState {
  if (!confirmation) return 'empty'
  return password === confirmation ? 'match' : 'mismatch'
}
