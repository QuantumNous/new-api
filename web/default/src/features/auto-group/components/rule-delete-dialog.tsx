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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { deleteAutoGroupRule } from '../api'
import { QUERY_KEYS, SUCCESS_MESSAGES } from '../constants'
import { useRulesDialog } from './rules-provider'

export function RuleDeleteDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow } = useRulesDialog()
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deleteAutoGroupRule,
  })

  const handleDelete = async () => {
    if (!currentRow) return
    setIsDeleting(true)
    try {
      const result = await deleteMutation.mutateAsync(currentRow.id)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.RULE_DELETED))
        setOpen(null)
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULES })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog
      open={open === 'delete'}
      onOpenChange={(open) => !open && setOpen(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('This will permanently delete the rule for job title')}{' '}
            <span className='font-semibold'>{currentRow?.job_title}</span>
            {t('. This action cannot be undone.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            variant='destructive'
          >
            {isDeleting ? t('Deleting...') : t('Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
