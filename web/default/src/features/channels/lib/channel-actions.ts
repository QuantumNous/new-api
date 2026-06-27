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
import type { QueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'
import { formatCurrencyFromUSD } from '@/lib/currency'
import {
  copyChannel,
  deleteChannel,
  testChannel,
  updateChannel,
  updateChannelStatus,
  batchUpdateChannelStatus,
  batchDeleteChannels,
  batchSetChannelTag,
  enableTagChannels,
  disableTagChannels,
  deleteDisabledChannels,
  fixChannelAbilities,
  editTagChannels,
  testAllChannels,
  updateAllChannelsBalance,
  updateChannelBalance,
} from '../api'
import { CHANNEL_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import type { ChannelTestResponse, CopyChannelParams } from '../types'

// ============================================================================
// Query Keys
// ============================================================================

export const channelsQueryKeys = {
  all: ['channels'] as const,
  lists: () => [...channelsQueryKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) =>
    [...channelsQueryKeys.lists(), params] as const,
  details: () => [...channelsQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...channelsQueryKeys.details(), id] as const,
}

function getChannelTestResponseTime(
  response: ChannelTestResponse
): number | undefined {
  const responseTime = response.data?.response_time
  if (typeof responseTime === 'number' && Number.isFinite(responseTime)) {
    return responseTime
  }

  if (
    typeof response.time === 'number' &&
    Number.isFinite(response.time) &&
    response.time > 0
  ) {
    return Math.round(response.time * 1000)
  }

  return undefined
}

function formatChannelTestDuration(responseTime?: number): string | undefined {
  if (responseTime === undefined) return undefined

  if (responseTime >= 1000) {
    return `${(responseTime / 1000).toFixed(2)} s`
  }

  return `${Math.max(1, Math.round(responseTime))} ms`
}

function getChannelTestLabel(options?: {
  channelName?: string
  testModel?: string
}): string {
  const channelName = options?.channelName?.trim()
  const testModel = options?.testModel?.trim()

  if (channelName && testModel) {
    return i18next.t('Channel {{name}} model {{model}}', {
      name: channelName,
      model: testModel,
    })
  }

  if (channelName) {
    return i18next.t('Channel {{name}}', { name: channelName })
  }

  if (testModel) {
    return i18next.t('Model {{model}}', { model: testModel })
  }

  return i18next.t('Channel')
}

// ============================================================================
// Single Channel Actions
// ============================================================================

/**
 * Enable a channel
 */
export async function handleEnableChannel(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await updateChannelStatus(id, CHANNEL_STATUS.ENABLED)
    if (response.success) {
      toast.success(i18next.t(SUCCESS_MESSAGES.ENABLED))
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
    }
  } catch (_error) {
    toast.error(i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
  }
}

/**
 * Disable a channel
 */
export async function handleDisableChannel(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await updateChannelStatus(
      id,
      CHANNEL_STATUS.MANUAL_DISABLED
    )
    if (response.success) {
      toast.success(i18next.t(SUCCESS_MESSAGES.DISABLED))
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
    }
  } catch (_error) {
    toast.error(i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
  }
}

/**
 * Toggle channel status (enable/disable)
 */
export async function handleToggleChannelStatus(
  id: number,
  currentStatus: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  if (currentStatus === CHANNEL_STATUS.ENABLED) {
    await handleDisableChannel(id, queryClient, onSuccess)
  } else {
    await handleEnableChannel(id, queryClient, onSuccess)
  }
}

/**
 * Delete a channel
 */
export async function handleDeleteChannel(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await deleteChannel(id)
    if (response.success) {
      toast.success(i18next.t(SUCCESS_MESSAGES.DELETED))
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t(ERROR_MESSAGES.DELETE_FAILED))
    }
  } catch (_error) {
    toast.error(i18next.t(ERROR_MESSAGES.DELETE_FAILED))
  }
}

/**
 * Update a specific channel field (e.g., priority, weight)
 */
export async function handleUpdateChannelField(
  id: number,
  fieldName: string,
  value: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await updateChannel(id, { [fieldName]: value })
    if (response.success) {
      // Show success toast with field name
      const fieldLabel =
        fieldName.charAt(0).toUpperCase() + fieldName.slice(1).toLowerCase()
      toast.success(
        i18next.t('{{field}} updated to {{value}}', {
          field: fieldLabel,
          value,
        })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
    }
  } catch (_error) {
    toast.error(i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
  }
}

/**
 * Update a specific field for all channels with a tag
 */
export async function handleUpdateTagField(
  tag: string,
  fieldName: 'priority' | 'weight',
  value: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const params = { tag, [fieldName]: value }
    const response = await editTagChannels(params)
    if (response.success) {
      // Show success toast with field name
      const fieldLabel =
        fieldName.charAt(0).toUpperCase() + fieldName.slice(1).toLowerCase()
      toast.success(
        i18next.t('{{field}} updated to {{value}} for tag: {{tag}}', {
          field: fieldLabel,
          value,
          tag,
        })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
    }
  } catch (_error) {
    toast.error(i18next.t(ERROR_MESSAGES.UPDATE_FAILED))
  }
}

/**
 * Test channel connectivity
 */
export async function handleTestChannel(
  id: number,
  options?: {
    channelName?: string
    testModel?: string
    endpointType?: string
    stream?: boolean
    silent?: boolean
  },
  onTestComplete?: (
    success: boolean,
    responseTime?: number,
    error?: string,
    errorCode?: string
  ) => void
): Promise<void> {
  const payload =
    options && (options.testModel || options.endpointType || options.stream)
      ? {
          ...(options.testModel ? { model: options.testModel } : {}),
          ...(options.endpointType
            ? { endpoint_type: options.endpointType }
            : {}),
          ...(options.stream ? { stream: true } : {}),
        }
      : undefined

  try {
    const response = await testChannel(id, payload)
    const responseTime = getChannelTestResponseTime(response)
    const duration = formatChannelTestDuration(responseTime)
    const target = getChannelTestLabel(options)
    if (response.success) {
      if (!options?.silent) {
        toast.success(
          i18next.t('{{target}} test succeeded', { target }),
          duration
            ? {
                description: i18next.t('Response time: {{duration}}', {
                  duration,
                }),
              }
            : undefined
        )
      }
      onTestComplete?.(true, responseTime)
    } else {
      const errorMsg = response.message || i18next.t(ERROR_MESSAGES.TEST_FAILED)
      if (!options?.silent) {
        toast.error(i18next.t('{{target}} test failed', { target }), {
          description: response.error_code
            ? `${errorMsg} (${response.error_code})`
            : errorMsg,
        })
      }
      onTestComplete?.(false, responseTime, errorMsg, response.error_code)
    }
  } catch (_error: unknown) {
    const err = _error as { response?: { data?: { message?: string } } }
    const errorMsg =
      err?.response?.data?.message || i18next.t(ERROR_MESSAGES.TEST_FAILED)
    const target = getChannelTestLabel(options)
    if (!options?.silent) {
      toast.error(i18next.t('{{target}} test failed', { target }), {
        description: errorMsg,
      })
    }
    onTestComplete?.(false, undefined, errorMsg)
  }
}

/**
 * Copy a channel
 */
export async function handleCopyChannel(
  id: number,
  params: CopyChannelParams,
  queryClient?: QueryClient,
  onSuccess?: (newId: number) => void
): Promise<void> {
  try {
    const response = await copyChannel(id, params)
    if (response.success) {
      toast.success(i18next.t(SUCCESS_MESSAGES.COPIED))
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.(response.data?.id ?? 0)
    } else {
      toast.error(response.message || i18next.t('Failed to copy channel'))
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to copy channel'))
  }
}

/**
 * Update channel balance
 */
export async function handleUpdateChannelBalance(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: (balance: number) => void
): Promise<void> {
  try {
    const response = await updateChannelBalance(id)
    if (response.success && response.balance !== undefined) {
      const balance = response.balance
      toast.success(
        i18next.t('Balance updated: {{balance}}', {
          balance: formatCurrencyFromUSD(balance, {
            digitsLarge: 2,
            digitsSmall: 4,
            abbreviate: false,
          }),
        })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.(balance)
    } else {
      toast.error(response.message || i18next.t('Failed to update balance'))
    }
  } catch (_error: unknown) {
    toast.error(
      _error instanceof Error
        ? _error.message
        : i18next.t('Failed to update balance')
    )
  }
}

// ============================================================================
// Batch Actions
// ============================================================================

/**
 * Batch delete channels
 */
export async function handleBatchDelete(
  ids: number[],
  queryClient?: QueryClient,
  onSuccess?: (deletedCount: number) => void
): Promise<void> {
  if (ids.length === 0) {
    toast.error(i18next.t('No channels selected'))
    return
  }

  try {
    const response = await batchDeleteChannels({ ids })
    if (response.success) {
      toast.success(
        i18next.t('{{count}} channel(s) deleted', {
          count: response.data || ids.length,
        })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.(response.data || ids.length)
    } else {
      toast.error(response.message || i18next.t(ERROR_MESSAGES.DELETE_FAILED))
    }
  } catch (_error) {
    toast.error(i18next.t(ERROR_MESSAGES.DELETE_FAILED))
  }
}

/**
 * Batch enable channels
 */
export async function handleBatchEnable(
  ids: number[],
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  if (ids.length === 0) {
    toast.error(i18next.t('No channels selected'))
    return
  }

  try {
    const response = await batchUpdateChannelStatus(
      ids,
      CHANNEL_STATUS.ENABLED
    )
    const successCount = response.success ? response.data || 0 : 0
    const failCount = ids.length - successCount

    if (successCount > 0) {
      toast.success(
        i18next.t('{{count}} channel(s) enabled', { count: successCount })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    }

    if (!response.success) {
      toast.error(response.message || i18next.t('Failed to enable channels'))
    } else if (failCount > 0) {
      toast.error(
        i18next.t('{{count}} channel(s) failed to enable', { count: failCount })
      )
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to enable channels'))
  }
}

/**
 * Batch disable channels
 */
export async function handleBatchDisable(
  ids: number[],
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  if (ids.length === 0) {
    toast.error(i18next.t('No channels selected'))
    return
  }

  try {
    const response = await batchUpdateChannelStatus(
      ids,
      CHANNEL_STATUS.MANUAL_DISABLED
    )
    const successCount = response.success ? response.data || 0 : 0
    const failCount = ids.length - successCount

    if (successCount > 0) {
      toast.success(
        i18next.t('{{count}} channel(s) disabled', { count: successCount })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    }

    if (!response.success) {
      toast.error(response.message || i18next.t('Failed to disable channels'))
    } else if (failCount > 0) {
      toast.error(
        i18next.t('{{count}} channel(s) failed to disable', {
          count: failCount,
        })
      )
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to disable channels'))
  }
}

/**
 * Batch set tag
 */
export async function handleBatchSetTag(
  ids: number[],
  tag: string | null,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  if (ids.length === 0) {
    toast.error(i18next.t('No channels selected'))
    return
  }

  try {
    const response = await batchSetChannelTag({ ids, tag })
    if (response.success) {
      toast.success(i18next.t(SUCCESS_MESSAGES.TAG_SET))
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t('Failed to set tag'))
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to set tag'))
  }
}

// ============================================================================
// Tag-Based Actions
// ============================================================================

/**
 * Enable all channels with a tag
 */
export async function handleEnableTagChannels(
  tag: string,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await enableTagChannels(tag)
    if (response.success) {
      toast.success(
        i18next.t('Enabled all channels with tag: {{tag}}', { tag })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(
        response.message || i18next.t('Failed to enable tag channels')
      )
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to enable tag channels'))
  }
}

/**
 * Disable all channels with a tag
 */
export async function handleDisableTagChannels(
  tag: string,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await disableTagChannels(tag)
    if (response.success) {
      toast.success(
        i18next.t('Disabled all channels with tag: {{tag}}', { tag })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(
        response.message || i18next.t('Failed to disable tag channels')
      )
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to disable tag channels'))
  }
}

// ============================================================================
// System Actions
// ============================================================================

/**
 * Delete all disabled channels
 */
export async function handleDeleteAllDisabled(
  queryClient?: QueryClient,
  onSuccess?: (deletedCount: number) => void
): Promise<void> {
  try {
    const response = await deleteDisabledChannels()
    if (response.success) {
      toast.success(
        i18next.t('{{count}} disabled channel(s) deleted', {
          count: response.data || 0,
        })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.(response.data || 0)
    } else {
      toast.error(
        response.message || i18next.t('Failed to delete disabled channels')
      )
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to delete disabled channels'))
  }
}

/**
 * Fix channel abilities
 */
export async function handleFixAbilities(
  queryClient?: QueryClient,
  onSuccess?: (result: { success: number; fails: number }) => void
): Promise<void> {
  try {
    const response = await fixChannelAbilities()
    if (response.success && response.data) {
      toast.success(
        i18next.t('Fixed abilities: {{success}} succeeded, {{fails}} failed', {
          success: response.data.success,
          fails: response.data.fails,
        })
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.(response.data)
    } else {
      toast.error(response.message || i18next.t('Failed to fix abilities'))
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to fix abilities'))
  }
}

/**
 * Test all enabled channels
 */
export async function handleTestAllChannels(
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await testAllChannels()
    if (response.success) {
      toast.success(
        i18next.t(
          'Testing all enabled channels started. Please refresh to see results.'
        )
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(
        response.message || i18next.t('Failed to start testing all channels')
      )
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to test all channels'))
  }
}

/**
 * Update balance for all enabled channels
 */
export async function handleUpdateAllBalances(
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await updateAllChannelsBalance()
    if (response.success) {
      toast.success(
        i18next.t(
          'Updating all channel balances. This may take a while. Please refresh to see results.'
        )
      )
      queryClient?.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(
        response.message || i18next.t('Failed to update all balances')
      )
    }
  } catch (_error) {
    toast.error(i18next.t('Failed to update all balances'))
  }
}
