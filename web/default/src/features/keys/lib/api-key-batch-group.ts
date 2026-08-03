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
import type { UserModelAccess } from '@/features/available-models'
import type { ApiKeyGroupOption } from '../components/api-key-group-combobox'
import type { ApiResponse } from '../types'

export const MAX_BATCH_EDIT_API_KEYS = 100

export type BatchEditApiKeysPayload = {
  ids: number[]
  group?: string
  remain_quota?: number
  model_limits_enabled?: boolean
  model_limits?: string
}

export type BatchEditApiKeysSuccessEffects = {
  resetSelection: () => void
  refresh: () => void
  resetForm: () => void
  closeDialog: () => void
}

type BatchEditApiKeysRequest = (
  payload: BatchEditApiKeysPayload
) => Promise<ApiResponse<number>>

type BatchEditApiKeysResult =
  | { success: true; count: number }
  | { success: false; message?: string }

type CoordinateBatchEditApiKeysParams = {
  request: BatchEditApiKeysRequest
  payload: BatchEditApiKeysPayload
  successEffects: BatchEditApiKeysSuccessEffects
}

export function buildBatchEditApiKeysPayload(
  ids: number[],
  edits: Omit<BatchEditApiKeysPayload, 'ids'>
): BatchEditApiKeysPayload {
  if (ids.length === 0 || ids.length > MAX_BATCH_EDIT_API_KEYS) {
    throw new RangeError(
      `Batch edits require 1-${MAX_BATCH_EDIT_API_KEYS} API keys`
    )
  }
  const modelLimitsProvided =
    edits.model_limits_enabled !== undefined || edits.model_limits !== undefined
  if (
    edits.group === undefined &&
    edits.remain_quota === undefined &&
    !modelLimitsProvided
  ) {
    throw new Error('At least one batch edit is required')
  }
  if (
    (edits.model_limits_enabled === undefined) !==
    (edits.model_limits === undefined)
  ) {
    throw new Error('Model allowlist fields must be provided together')
  }
  if (edits.group !== undefined && edits.group.length === 0) {
    throw new Error('The selected group cannot be empty')
  }
  if (
    edits.remain_quota !== undefined &&
    (!Number.isFinite(edits.remain_quota) || edits.remain_quota < 0)
  ) {
    throw new RangeError('Available quota must be a finite non-negative value')
  }

  const payload: BatchEditApiKeysPayload = { ids: [...ids] }
  if (edits.group !== undefined) payload.group = edits.group
  if (edits.remain_quota !== undefined) {
    payload.remain_quota = edits.remain_quota
  }
  if (edits.model_limits_enabled !== undefined) {
    payload.model_limits_enabled = edits.model_limits_enabled
    payload.model_limits = edits.model_limits_enabled
      ? (edits.model_limits ?? '')
      : ''
  }
  return payload
}

export function getBatchGroupOptions(
  modelAccess: UserModelAccess | undefined
): ApiKeyGroupOption[] {
  return (
    modelAccess?.groups.map((group) => ({
      value: group.id,
      label: group.label,
      desc: group.description,
      ratio: group.ratio ?? undefined,
    })) ?? []
  )
}

export function canBatchEditApiKeyGroup(
  canUseGroups: boolean,
  modelAccess: UserModelAccess | undefined
): boolean {
  return (
    canUseGroups &&
    modelAccess?.scope_mode === 'selectable_group' &&
    modelAccess.groups.length > 0
  )
}

export function isBatchEditApiKeysAvailable(featureEnabled: boolean): boolean {
  return featureEnabled
}

export function isBatchQuotaInputValid(
  rawValue: string,
  tokensOnly: boolean
): boolean {
  if (rawValue.trim() === '') return false

  const value = Number(rawValue)
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    (!tokensOnly || Number.isInteger(value))
  )
}

export async function coordinateBatchEditApiKeys(
  params: CoordinateBatchEditApiKeysParams
): Promise<BatchEditApiKeysResult> {
  const payload = buildBatchEditApiKeysPayload(params.payload.ids, {
    group: params.payload.group,
    remain_quota: params.payload.remain_quota,
    model_limits_enabled: params.payload.model_limits_enabled,
    model_limits: params.payload.model_limits,
  })
  const response = await params.request(payload)

  if (!response.success) {
    return { success: false, message: response.message }
  }

  params.successEffects.resetSelection()
  params.successEffects.refresh()
  params.successEffects.resetForm()
  params.successEffects.closeDialog()

  return { success: true, count: response.data ?? payload.ids.length }
}
