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

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { deleteThirdPartySite } from '../api'
import { SUCCESS_MESSAGES, THIRD_PARTY_SITES_QUERY_KEY } from '../constants'
import { useThirdPartySites } from './third-party-sites-provider'

export function ThirdPartySiteDeleteDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { open, setOpen, currentRow } = useThirdPartySites()

  const mutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await deleteThirdPartySite(id)
      if (!res.success) throw createServerError(res)
      return res
    },
    onSuccess: () => {
      toast.success(t(SUCCESS_MESSAGES.SITE_DELETED))
      void queryClient.invalidateQueries({
        queryKey: THIRD_PARTY_SITES_QUERY_KEY,
      })
      setOpen(null)
    },
    onError: (error: Error) => handleServerError(error),
  })

  return (
    <ConfirmDialog
      destructive
      open={open === 'delete'}
      onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      title={t('Delete Site')}
      desc={t('Delete site {{name}}? It will no longer appear in the list.', {
        name: currentRow?.name ?? '',
      })}
      confirmText={mutation.isPending ? t('Deleting...') : t('Delete')}
      isLoading={mutation.isPending}
      handleConfirm={() => {
        if (currentRow) mutation.mutate(currentRow.id)
      }}
    />
  )
}
