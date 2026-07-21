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

import {
  getSafeServerMessage,
  resolveMutationErrorMessage,
  updateSystemOption,
  updateSystemOptions,
} from '../api'
import type { UpdateOptionRequest } from '../types'

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
  'legal.user_agreement',
  'legal.privacy_policy',
  'legal.refund_policy',
])

const LEGAL_DOCUMENT_QUERY_KEYS = new Map([
  ['legal.user_agreement', 'user-agreement'],
  ['legal.privacy_policy', 'privacy-policy'],
  ['legal.refund_policy', 'refund-policy'],
])

export function useUpdateOption() {
  const queryClient = useQueryClient()

  const refetchSystemOptions = () => {
    void queryClient.invalidateQueries({
      queryKey: ['system-options'],
      refetchType: 'active',
    })
  }

  return useMutation({
    mutationFn: (request: UpdateOptionRequest | UpdateOptionRequest[]) =>
      Array.isArray(request)
        ? updateSystemOptions(request)
        : updateSystemOption(request),
    onSuccess: (data, variables) => {
      if (data.success) {
        // Always refresh system-options
        refetchSystemOptions()

        // If updating frontend-display-related config, also refresh status
        const requests = Array.isArray(variables) ? variables : [variables]
        if (requests.some((request) => STATUS_RELATED_KEYS.has(request.key))) {
          queryClient.invalidateQueries({ queryKey: ['status'] })
          try {
            window.localStorage.removeItem('status')
          } catch {
            /* empty */
          }
        }

        for (const request of requests) {
          const legalDocumentQueryKey = LEGAL_DOCUMENT_QUERY_KEYS.get(
            request.key
          )
          if (legalDocumentQueryKey) {
            queryClient.invalidateQueries({
              queryKey: [legalDocumentQueryKey],
            })
          }
        }

        toast.success(i18next.t('Setting updated successfully'))
      } else {
        toast.error(
          getSafeServerMessage(data.message) ||
            i18next.t('Failed to update setting')
        )
        refetchSystemOptions()
      }
    },
    onError: (error: unknown) => {
      toast.error(
        resolveMutationErrorMessage(error, {
          conflict: i18next.t(
            'Pricing settings changed on the server. The latest values were reloaded; review them and try again.'
          ),
          server: i18next.t(
            'The server could not save your changes. Please try again.'
          ),
          fallback: i18next.t('Failed to update setting'),
        })
      )
      refetchSystemOptions()
    },
  })
}
