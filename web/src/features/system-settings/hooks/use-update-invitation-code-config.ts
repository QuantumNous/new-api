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
import { isAxiosError } from 'axios'
import i18next from 'i18next'
import { toast } from 'sonner'

import { updateInvitationCodeConfig } from '../api'
import type { UpdateInvitationCodeConfigRequest } from '../types'

export function useUpdateInvitationCodeConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: UpdateInvitationCodeConfigRequest) => {
      const response = await updateInvitationCodeConfig(request)
      if (!response.success) {
        throw new Error(
          response.message || i18next.t('Failed to update setting')
        )
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      try {
        window.localStorage.removeItem('status')
      } catch {
        /* empty */
      }
      toast.success(i18next.t('Setting updated successfully'))
    },
    onError: (error) => {
      if (isAxiosError(error)) return
      toast.error(error.message || i18next.t('Failed to update setting'))
    },
  })
}
