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
import { useId } from 'react'

import { updateSystemOption } from '../api'
import type { UpdateOptionRequest } from '../types'
import {
  showUpdateOptionError,
  showUpdateOptionSuccess,
  type UpdateOptionNotification,
} from './update-option-notification'

type UpdateOptionMutationRequest = UpdateOptionRequest & {
  notification?: UpdateOptionNotification
}

// Configuration keys that require status refresh
const STATUS_RELATED_KEYS = new Set([
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
])

export function useUpdateOption() {
  const queryClient = useQueryClient()
  const toastId = useId()

  return useMutation({
    mutationFn: (request: UpdateOptionMutationRequest) =>
      updateSystemOption({ key: request.key, value: request.value }),
    onSuccess: (_data, variables) => {
      // Always refresh system-options
      queryClient.invalidateQueries({ queryKey: ['system-options'] })

      // If updating frontend-display-related config, also refresh status
      if (STATUS_RELATED_KEYS.has(variables.key)) {
        queryClient.invalidateQueries({ queryKey: ['status'] })
        try {
          window.localStorage.removeItem('status')
        } catch {
          /* empty */
        }
      }

      showUpdateOptionSuccess(variables.notification, toastId)
    },
    onError: (error, variables) => {
      showUpdateOptionError(error, variables.notification, toastId)
    },
  })
}
