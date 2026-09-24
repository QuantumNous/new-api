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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import { parseSensitiveWordDraftWords } from './draft-search'
import type {
  SensitiveWordPolicy,
  SensitiveWordRuleDetail,
  SensitiveWordRuleDraft,
  SensitiveWordRuleSummary,
} from './types'

type Response<T> = { success: boolean; message?: string; data: T }

function requireRecord<T extends object>(value: unknown, endpoint: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid response from ${endpoint}`)
  }
  return value as T
}

function requireArray<T>(value: unknown, endpoint: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid response from ${endpoint}`)
  }
  return value as T[]
}

export async function getSensitiveWordPolicy() {
  const response = await api.get<Response<SensitiveWordPolicy>>(
    '/api/sensitive-words/policy'
  )
  return requireRecord<SensitiveWordPolicy>(
    requireServerSuccess(response.data).data,
    '/api/sensitive-words/policy'
  )
}

export async function saveSensitiveWordPolicy(policy: SensitiveWordPolicy) {
  const response = await api.put<Response<SensitiveWordPolicy>>(
    '/api/sensitive-words/policy',
    policy
  )
  return requireRecord<SensitiveWordPolicy>(
    requireServerSuccess(response.data).data,
    '/api/sensitive-words/policy'
  )
}

export async function getSensitiveWordGroups() {
  const response = await api.get<Response<string[]>>(
    '/api/sensitive-words/groups'
  )
  return requireArray<string>(
    requireServerSuccess(response.data).data,
    '/api/sensitive-words/groups'
  )
}

export async function getSensitiveWordRules() {
  const response = await api.get<Response<SensitiveWordRuleSummary[]>>(
    '/api/sensitive-words/rules'
  )
  return requireArray<SensitiveWordRuleSummary>(
    requireServerSuccess(response.data).data,
    '/api/sensitive-words/rules'
  )
}

export async function getSensitiveWordRule(id: number) {
  const response = await api.get<Response<SensitiveWordRuleDetail>>(
    `/api/sensitive-words/rules/${id}`
  )
  return requireRecord<SensitiveWordRuleDetail>(
    requireServerSuccess(response.data).data,
    `/api/sensitive-words/rules/${id}`
  )
}

export async function saveSensitiveWordRule(draft: SensitiveWordRuleDraft) {
  const payload = {
    name: draft.name.trim(),
    words: parseSensitiveWordDraftWords(draft.wordsText),
    scope: draft.scope,
    groups: draft.groups,
    mode: draft.mode,
  }
  const response = draft.id
    ? await api.put<Response<SensitiveWordRuleDetail>>(
        `/api/sensitive-words/rules/${draft.id}`,
        payload
      )
    : await api.post<Response<SensitiveWordRuleDetail>>(
        '/api/sensitive-words/rules',
        payload
      )
  return requireRecord<SensitiveWordRuleDetail>(
    requireServerSuccess(response.data).data,
    draft.id
      ? `/api/sensitive-words/rules/${draft.id}`
      : '/api/sensitive-words/rules'
  )
}

export async function setSensitiveWordRuleMode(
  id: number,
  mode: SensitiveWordRuleDraft['mode']
) {
  const response = await api.patch<Response<null>>(
    `/api/sensitive-words/rules/${id}/mode`,
    { mode }
  )
  return requireServerSuccess(response.data).data
}

export async function deleteSensitiveWordRule(id: number) {
  const response = await api.delete<Response<null>>(
    `/api/sensitive-words/rules/${id}`
  )
  return requireServerSuccess(response.data).data
}
