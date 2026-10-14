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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'

import { savePolicyConfig } from './api'

export function useSavePolicy() {
  const client = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: savePolicyConfig,
    onSuccess: (data) => {
      client.setQueryData(['request-policy'], data)
      void client.invalidateQueries({ queryKey: ['system-options'] })
      void client.invalidateQueries({ queryKey: ['channel-ops'] })
      toast.success(t('Saved successfully'))
    },
    onError: (error) => handleServerError(error),
    meta: { errorToast: false },
  })
}
