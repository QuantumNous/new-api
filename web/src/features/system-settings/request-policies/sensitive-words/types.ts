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
export type SensitiveWordMode = 'block' | 'observe' | 'off'
export type SensitiveWordScope = 'global' | 'group'

export type SensitiveWordPolicy = {
  id: number
  enabled: boolean
  check_prompt: boolean
  retain_full_prompt: boolean
  block_message: string
  ban_threshold: number
  full_prompt_retention_days: number
  max_prompt_runes: number
  version: number
}

export type SensitiveWordRuleSummary = {
  id: number
  name: string
  scope: SensitiveWordScope
  mode: SensitiveWordMode
  groups: string[]
  word_count: number
  created_by: number
  version: number
  created_at: string
  updated_at: string
}

export type SensitiveWordRuleDetail = SensitiveWordRuleSummary & {
  words: string[]
}

export type SensitiveWordRuleDraft = {
  id?: number
  name: string
  wordsText: string
  scope: SensitiveWordScope
  groups: string[]
  mode: SensitiveWordMode
}

export const DEFAULT_SENSITIVE_WORD_POLICY: SensitiveWordPolicy = {
  id: 1,
  enabled: true,
  check_prompt: true,
  retain_full_prompt: true,
  block_message:
    'Your request was blocked because it matched a sensitive word. This has been recorded; reaching {{threshold}} violations disables the account.',
  ban_threshold: 50,
  full_prompt_retention_days: 180,
  max_prompt_runes: 65536,
  version: 1,
}

export function emptySensitiveWordRuleDraft(): SensitiveWordRuleDraft {
  return {
    name: '',
    wordsText: '',
    scope: 'global',
    groups: [],
    mode: 'observe',
  }
}
