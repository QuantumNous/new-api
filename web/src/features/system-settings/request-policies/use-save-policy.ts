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
    onSuccess: (data, options) => {
      client.setQueryData(['request-policy'], data)
      void client.invalidateQueries({ queryKey: ['system-options'] })
      void client.invalidateQueries({ queryKey: ['channel-ops'] })
      if ('channel_affinity_setting.rules' in options) {
        void client.invalidateQueries({ queryKey: ['channel-affinity-cache'] })
      }
      toast.success(t('Saved successfully'))
    },
    onError: (error) => handleServerError(error),
    meta: { errorToast: false },
  })
}
