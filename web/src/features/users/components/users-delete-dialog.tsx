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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'

import { deleteUser } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { getUserActionMessage } from '../lib'
import { useUsers } from './users-provider'

export function UsersDeleteDialog() {
  const { t } = useTranslation()
  const {
    open,
    setOpen,
    currentRow,
    triggerRefresh,
    requestVerification,
    verificationActive,
  } = useUsers()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!currentRow) return

    setIsDeleting(true)
    try {
      const proof = await requestVerification({
        scope: 'admin.user.delete',
        context: { user_id: currentRow.id },
        title: t('Verify to delete user'),
        description: t(
          'Confirm your identity before permanently deleting the account {{username}}.',
          { username: currentRow.username }
        ),
      })
      if (!proof) return
      const result = await deleteUser(currentRow.id, proof.proof_token)
      if (result.success) {
        toast.success(t(getUserActionMessage('delete')))
        setOpen(null)
        triggerRefresh()
      } else {
        handleServerError(result, t(ERROR_MESSAGES.DELETE_FAILED))
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ConfirmDialog
      open={open === 'delete' && !verificationActive}
      onOpenChange={(open) => !open && setOpen(null)}
      title={t('Are you sure?')}
      desc={
        <>
          {t('This will permanently delete user')}{' '}
          <span className='font-semibold'>{currentRow?.username}</span>
          {t('. This action cannot be undone.')}
        </>
      }
      confirmText={isDeleting ? t('Deleting...') : t('Delete')}
      destructive
      isLoading={isDeleting}
      handleConfirm={handleDelete}
    />
  )
}
