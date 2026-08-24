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

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 20
export const PASSWORD_MIN_STRENGTH_SCORE = 2

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4

export interface PasswordStrength {
  score: PasswordStrengthScore
  labelKey: string
  color: string
  percent: number
}

const scoreToMeta: Record<
  Exclude<PasswordStrengthScore, 0>,
  { labelKey: string; color: string }
> = {
  1: { labelKey: 'Weak password', color: 'bg-red-500' },
  2: { labelKey: 'Fair password', color: 'bg-amber-500' },
  3: { labelKey: 'Good password', color: 'bg-green-500' },
  4: { labelKey: 'Strong password', color: 'bg-green-600' },
}

function countCharacterClasses(password: string): number {
  let classes = 0
  if (/[a-z]/.test(password)) classes++
  if (/[A-Z]/.test(password)) classes++
  if (/\d/.test(password)) classes++
  if (/[^a-zA-Z0-9]/.test(password)) classes++
  return classes
}

export function passwordStrength(password: string): PasswordStrength {
  const length = password.length
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    return {
      score: 0,
      labelKey: 'Password is too short',
      color: 'bg-red-500',
      percent: 0,
    }
  }

  const classes = countCharacterClasses(password)
  if (classes < 3) {
    return {
      score: 1,
      labelKey: 'Weak password',
      color: 'bg-red-500',
      percent: 25,
    }
  }

  let score: Exclude<PasswordStrengthScore, 0> = 2
  if (length >= 12 && classes >= 3) score = 3
  if ((length >= 14 && classes >= 4) || (length >= 16 && classes >= 3)) {
    score = 4
  }

  const meta = scoreToMeta[score]
  return {
    score,
    labelKey: meta.labelKey,
    color: meta.color,
    percent: score * 25,
  }
}
