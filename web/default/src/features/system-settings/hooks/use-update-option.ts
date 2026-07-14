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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'

import { updateSystemOption } from '../api'
import type { UpdateOptionRequest } from '../types'

// Configuration keys that require status refresh
const STATUS_RELATED_KEYS = [
  'theme.frontend',
  'HeaderNavModules',
  'SidebarModulesAdmin',
  'Notice',
  'LogConsumeEnabled',
  'QuotaPerUnit',
  'USDExchangeRate',
  'DisplayInCurrencyEnabled',
  'DisplayTokenStatEnabled',
  'general_setting.quota_display_type',
  'general_setting.custom_currency_symbol',
  'general_setting.custom_currency_exchange_rate',
]

// Debounce timers to batch invalidations and toasts across sequential mutations.
let invalidateOptionsTimer: ReturnType<typeof setTimeout> | null = null
let invalidateStatusTimer: ReturnType<typeof setTimeout> | null = null
let successToastTimer: ReturnType<typeof setTimeout> | null = null
let hasBatchError = false
let batchErrorTimer: ReturnType<typeof setTimeout> | null = null

function scheduleOptionsInvalidate(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  if (invalidateOptionsTimer) clearTimeout(invalidateOptionsTimer)
  invalidateOptionsTimer = setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ['system-options'] })
    invalidateOptionsTimer = null
  }, 100)
}

function scheduleStatusInvalidate(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  if (invalidateStatusTimer) clearTimeout(invalidateStatusTimer)
  invalidateStatusTimer = setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    try {
      window.localStorage.removeItem('status')
    } catch {
      /* empty */
    }
    invalidateStatusTimer = null
  }, 100)
}

function scheduleSuccessToast() {
  if (hasBatchError) return
  if (successToastTimer) clearTimeout(successToastTimer)
  successToastTimer = setTimeout(() => {
    toast.success(i18next.t('Setting updated successfully'))
    successToastTimer = null
  }, 100)
}

function handleBatchError(message: string) {
  // Cancel pending success toast
  if (successToastTimer) {
    clearTimeout(successToastTimer)
    successToastTimer = null
  }

  // Set error flag to block subsequent success toasts in the current batch
  hasBatchError = true
  if (batchErrorTimer) clearTimeout(batchErrorTimer)
  batchErrorTimer = setTimeout(() => {
    hasBatchError = false
  }, 200)

  // Show error immediately
  toast.error(message)
}

export function useUpdateOption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateOptionRequest) => updateSystemOption(request),
    onSuccess: (data, variables) => {
      if (data.success) {
        scheduleOptionsInvalidate(queryClient)

        if (STATUS_RELATED_KEYS.includes(variables.key)) {
          scheduleStatusInvalidate(queryClient)
        }

        scheduleSuccessToast()
      } else {
        // Errors are shown immediately for instant feedback
        handleBatchError(data.message || i18next.t('Failed to update setting'))
      }
    },
    onError: (error: Error) => {
      handleBatchError(error.message || i18next.t('Failed to update setting'))
    },
  })
}
