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

import {
  updateModelStatus,
  batchUpdateModelStatus,
  deleteModel as deleteModelAPI,
  batchDisableModelsNoChannels,
  batchEnableModelsWithChannels,
} from '../api'
import { modelsQueryKeys } from './query-keys'

// ============================================================================
// Model Status Actions
// ============================================================================

/**
 * Enable a model
 */
export async function handleEnableModel(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await updateModelStatus(id, 1)
    if (response.success) {
      queryClient?.invalidateQueries({ queryKey: modelsQueryKeys.all })
    }
    if (response.success && response.data?.status === 1) {
      toast.success(i18next.t('Model enabled successfully'))
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t('Failed to enable model'))
    }
  } catch (error: unknown) {
    toast.error(
      (error as Error)?.message || i18next.t('Failed to enable model')
    )
  }
}

/**
 * Disable a model
 */
export async function handleDisableModel(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await updateModelStatus(id, 0)
    if (response.success) {
      queryClient?.invalidateQueries({ queryKey: modelsQueryKeys.all })
    }
    if (response.success && response.data?.status === 0) {
      toast.success(i18next.t('Model disabled successfully'))
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t('Failed to disable model'))
    }
  } catch (error: unknown) {
    toast.error(
      (error as Error)?.message || i18next.t('Failed to disable model')
    )
  }
}

/**
 * Toggle model status
 */
export async function handleToggleModelStatus(
  id: number,
  currentStatus: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  if (currentStatus === 1) {
    await handleDisableModel(id, queryClient, onSuccess)
  } else {
    await handleEnableModel(id, queryClient, onSuccess)
  }
}

// ============================================================================
// Model Delete Actions
// ============================================================================

/**
 * Delete a single model
 */
export async function handleDeleteModel(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await deleteModelAPI(id)
    if (response.success) {
      toast.success(i18next.t('Model deleted successfully'))
      queryClient?.invalidateQueries({ queryKey: modelsQueryKeys.all })
      onSuccess?.()
    } else {
      toast.error(response.message || i18next.t('Failed to delete model'))
    }
  } catch (error: unknown) {
    toast.error(
      (error as Error)?.message || i18next.t('Failed to delete model')
    )
  }
}

/**
 * Batch delete models
 */
export async function handleBatchDeleteModels(
  ids: number[],
  queryClient?: QueryClient,
  onSuccess?: (deletedCount: number) => void
): Promise<void> {
  if (ids.length === 0) {
    toast.error(i18next.t('Please select at least one model'))
    return
  }

  try {
    const deletePromises = ids.map((id) => deleteModelAPI(id))
    const results = await Promise.all(deletePromises)

    let successCount = 0
    let failedCount = 0

    results.forEach((res, index) => {
      if (res.success) {
        successCount++
      } else {
        failedCount++
        // eslint-disable-next-line no-console
        console.error(`Failed to delete model ${ids[index]}:`, res.message)
      }
    })

    if (successCount > 0) {
      toast.success(
        i18next.t('Successfully deleted {{count}} model(s)', {
          count: successCount,
        })
      )
      queryClient?.invalidateQueries({ queryKey: modelsQueryKeys.all })
      onSuccess?.(successCount)
    }

    if (failedCount > 0) {
      toast.error(
        i18next.t('Failed to delete {{count}} model(s)', { count: failedCount })
      )
    }
  } catch (error: unknown) {
    toast.error((error as Error)?.message || i18next.t('Batch delete failed'))
  }
}

// ============================================================================
// Batch Status Actions
// ============================================================================

/**
 * Batch enable models
 */
export async function handleBatchEnableModels(
  ids: number[],
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  if (ids.length === 0) {
    toast.error(i18next.t('Please select at least one model'))
    return
  }

  try {
    const response = await batchUpdateModelStatus(ids, 1)
    if (!response.success) {
      toast.error(response.message || i18next.t('Batch enable failed'))
      return
    }
    queryClient?.invalidateQueries({ queryKey: modelsQueryKeys.all })
    const successCount = response.data?.updated ?? 0
    const failedCount = response.data?.failed_ids.length ?? ids.length

    if (successCount > 0) {
      toast.success(
        i18next.t('Successfully enabled {{count}} model(s)', {
          count: successCount,
        })
      )
      onSuccess?.()
    }

    if (failedCount > 0) {
      toast.error(
        i18next.t('Failed to enable {{count}} model(s)', { count: failedCount })
      )
    }
  } catch (error: unknown) {
    toast.error((error as Error)?.message || i18next.t('Batch enable failed'))
  }
}

/**
 * Batch disable models
 */
export async function handleBatchDisableModels(
  ids: number[],
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  if (ids.length === 0) {
    toast.error(i18next.t('Please select at least one model'))
    return
  }

  try {
    const response = await batchUpdateModelStatus(ids, 0)
    if (!response.success) {
      toast.error(response.message || i18next.t('Batch disable failed'))
      return
    }
    queryClient?.invalidateQueries({ queryKey: modelsQueryKeys.all })
    const successCount = response.data?.updated ?? 0
    const failedCount = response.data?.failed_ids.length ?? ids.length

    if (successCount > 0) {
      toast.success(
        i18next.t('Successfully disabled {{count}} model(s)', {
          count: successCount,
        })
      )
      onSuccess?.()
    }

    if (failedCount > 0) {
      toast.error(
        i18next.t('Failed to disable {{count}} model(s)', {
          count: failedCount,
        })
      )
    }
  } catch (error: unknown) {
    toast.error((error as Error)?.message || i18next.t('Batch disable failed'))
  }
}

// ============================================================================
// Batch Channel Availability Actions
// ============================================================================

type BatchChannelAvailabilityResponse = {
  success: boolean
  message?: string
  data?: {
    disabled?: number
    enabled?: number
  }
}

async function runBatchChannelAvailabilityAction(options: {
  action: () => Promise<BatchChannelAvailabilityResponse>
  getCount: (data?: BatchChannelAvailabilityResponse['data']) => number
  successMessageKey: string
  emptyMessageKey: string
  failureMessageKey: string
  catchMessageKey: string
  queryClient?: QueryClient
  onSuccess?: (count: number) => void
}): Promise<boolean> {
  try {
    const response = await options.action()
    if (response.success) {
      const count = options.getCount(response.data)
      if (count > 0) {
        toast.success(i18next.t(options.successMessageKey, { count }))
      } else {
        toast.info(i18next.t(options.emptyMessageKey))
      }
      options.queryClient?.invalidateQueries({
        queryKey: modelsQueryKeys.all,
      })
      options.onSuccess?.(count)
      return true
    }

    toast.error(response.message || i18next.t(options.failureMessageKey))
    return false
  } catch (error: unknown) {
    toast.error((error as Error)?.message || i18next.t(options.catchMessageKey))
    return false
  }
}

/**
 * One-click disable all models that currently have no available channels.
 */
export async function handleBatchDisableModelsNoChannels(
  queryClient?: QueryClient,
  onSuccess?: (disabledCount: number) => void
): Promise<boolean> {
  return runBatchChannelAvailabilityAction({
    action: batchDisableModelsNoChannels,
    getCount: (data) => data?.disabled ?? 0,
    successMessageKey:
      'Successfully disabled {{count}} model(s) with no available channels',
    emptyMessageKey: 'No models with unavailable channels found',
    failureMessageKey: 'Failed to batch disable models',
    catchMessageKey: 'Batch disable failed',
    queryClient,
    onSuccess,
  })
}

/**
 * One-click enable all models that currently have available channels.
 */
export async function handleBatchEnableModelsWithChannels(
  queryClient?: QueryClient,
  onSuccess?: (enabledCount: number) => void
): Promise<boolean> {
  return runBatchChannelAvailabilityAction({
    action: batchEnableModelsWithChannels,
    getCount: (data) => data?.enabled ?? 0,
    successMessageKey:
      'Successfully enabled {{count}} model(s) with recovered channels',
    emptyMessageKey: 'No auto-disabled models with recovered channels found',
    failureMessageKey: 'Failed to batch enable models',
    catchMessageKey: 'Batch enable failed',
    queryClient,
    onSuccess,
  })
}
