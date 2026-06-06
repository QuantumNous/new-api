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
import type { SystemStatus } from '@/features/auth/types'
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

export function useUpdateOption() {
  const queryClient = useQueryClient()

  const patchStatusCache = (enabled: boolean) => {
    queryClient.setQueryData<SystemStatus | undefined>(['status'], (old) => {
      if (!old) return old
      return {
        ...old,
        perf_metrics_enabled: enabled,
      }
    })

    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('status')
        if (saved) {
          const parsed = JSON.parse(saved) as SystemStatus
          window.localStorage.setItem(
            'status',
            JSON.stringify({
              ...parsed,
              perf_metrics_enabled: enabled,
            })
          )
        }
      }
    } catch {
      /* empty */
    }
  }

  return useMutation({
    mutationFn: (request: UpdateOptionRequest) => updateSystemOption(request),
    onSuccess: (data, variables) => {
      if (data.success) {
        // Always refresh system-options
        queryClient.invalidateQueries({ queryKey: ['system-options'] })

        // If updating frontend-display-related config, also refresh status
        if (STATUS_RELATED_KEYS.includes(variables.key)) {
          if (variables.key === 'perf_metrics_setting.enabled') {
            patchStatusCache(Boolean(variables.value))
          }
          queryClient.invalidateQueries({ queryKey: ['status'] })
          if (variables.key !== 'perf_metrics_setting.enabled') {
            try {
              window.localStorage.removeItem('status')
            } catch {
              /* empty */
            }
          }
        }

        toast.success(i18next.t('Setting updated successfully'))
      } else {
        toast.error(data.message || i18next.t('Failed to update setting'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to update setting'))
    },
  })
}
