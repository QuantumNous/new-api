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
  resolveCreateScope,
  type UserModelAccess,
} from '@/features/available-models'
import type { ApiKeyFormData } from '../types'
import type { ApiKeyFormValues } from './api-key-form'

export type CreateDialogDeepLinkAction = {
  resolvedGroup?: string | null
  shouldOpen: boolean
}

export type CreateDialogRequestTransition = {
  requestKey: string | null
  shouldReset: boolean
}

export type ApiKeyModelAccessDirtyFields = Partial<
  Record<keyof ApiKeyFormValues, unknown>
>

export type ApiKeyModelAccessValues = Pick<
  ApiKeyFormValues,
  | 'group'
  | 'model_limits_enabled'
  | 'model_limits'
  | 'model_blacklist_enabled'
  | 'model_blacklist'
  | 'cross_group_retry'
>

export function getApiKeyModelPreviewPlacement(
  isDesktop: boolean
): 'desktop' | 'mobile' {
  return isDesktop ? 'desktop' : 'mobile'
}

export function isApiKeyUpdateDetailReady(
  isUpdate: boolean,
  currentKeyId: number | undefined,
  loadedKeyId: number | undefined
): boolean {
  return (
    !isUpdate || (currentKeyId !== undefined && loadedKeyId === currentKeyId)
  )
}

export function getCreateDialogRequestTransition(
  previousRequestKey: string | null,
  requested: boolean,
  requestedGroup?: string
): CreateDialogRequestTransition {
  const requestKey = requested ? `create:${requestedGroup ?? ''}` : null
  return {
    requestKey,
    shouldReset: requestKey !== previousRequestKey,
  }
}

export function requiresModelAccessForApiKeyMutation(
  isUpdate: boolean,
  dirtyFields: ApiKeyModelAccessDirtyFields,
  values?: ApiKeyModelAccessValues
): boolean {
  const hasModelAccessChanges = Boolean(
    dirtyFields.group ||
    dirtyFields.model_limits_enabled ||
    dirtyFields.model_limits ||
    dirtyFields.model_blacklist_enabled ||
    dirtyFields.model_blacklist ||
    dirtyFields.cross_group_retry
  )
  if (isUpdate) return hasModelAccessChanges
  if (!values) return true
  return Boolean(
    hasModelAccessChanges ||
    values.group ||
    values.model_limits_enabled ||
    values.model_limits.length > 0 ||
    values.model_blacklist_enabled ||
    values.model_blacklist.length > 0 ||
    values.cross_group_retry
  )
}

export function requestApiKeyModelAccessPreservation(
  payload: ApiKeyFormData
): ApiKeyFormData {
  return {
    ...payload,
    preserve_model_access: true,
  }
}

export function resolveSafeCreateScope(
  access: UserModelAccess | undefined,
  requestedGroup?: string | null
): string | null {
  if (!access) return requestedGroup ?? null
  return resolveCreateScope(access, requestedGroup ?? undefined)
}

export function shouldReinitializeCreateForm(options: {
  initializedRequestKey: string | undefined
  nextRequestKey: string | null | undefined
  open: boolean
  isUpdate: boolean
  scopeReady: boolean
}): boolean {
  const nextRequestKey = options.nextRequestKey ?? 'manual'
  return (
    options.open &&
    !options.isUpdate &&
    options.scopeReady &&
    options.initializedRequestKey !== nextRequestKey
  )
}

export function getCreateDialogDeepLinkAction(
  requested: boolean,
  access: UserModelAccess | undefined,
  isError: boolean,
  requestedGroup?: string
): CreateDialogDeepLinkAction {
  if (!requested) return { shouldOpen: false }
  if (access) {
    return {
      shouldOpen: true,
      resolvedGroup: resolveCreateScope(access, requestedGroup),
    }
  }
  return { shouldOpen: isError }
}

export function shouldApplyResolvedCreateGroup(options: {
  access: UserModelAccess | undefined
  groupDirty: boolean
  initialized: boolean
  isUpdate: boolean
  open: boolean
}): boolean {
  return (
    options.open &&
    !options.isUpdate &&
    options.initialized &&
    options.access !== undefined &&
    !options.groupDirty
  )
}
