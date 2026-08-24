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
import { useMemo, useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Loader2, PowerOff, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { batchVerifyEmails, manageUser } from '../api'
import { ERROR_MESSAGES } from '../constants'
import {
  disableUsersBatch,
  getBatchDisableUserTargets,
  getBatchVerifyEmailTargets,
} from '../lib/bulk-user-actions'
import { type User } from '../types'
import { useUsers } from './users-provider'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useUsers()
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedUsers = useMemo(
    () => selectedRows.map((row) => row.original),
    [selectedRows]
  )
  const disableTargets = useMemo(
    () => getBatchDisableUserTargets(selectedUsers),
    [selectedUsers]
  )
  const verifyTargets = useMemo(
    () => getBatchVerifyEmailTargets(selectedUsers),
    [selectedUsers]
  )

  const handleBatchDisable = async () => {
    if (disableTargets.length === 0) {
      toast.info(t('No selected users can be disabled'))
      setShowDisableConfirm(false)
      return
    }

    setIsDisabling(true)
    try {
      const { successCount, failedCount } = await disableUsersBatch(
        disableTargets,
        (user) => manageUser(user.id, 'disable')
      )

      if (successCount > 0) {
        toast.success(
          t('Successfully disabled {{count}} user(s)', {
            count: successCount,
          })
        )
      }

      if (failedCount > 0) {
        toast.error(
          t('Failed to disable {{count}} user(s)', { count: failedCount })
        )
      }

      if (successCount > 0) {
        table.resetRowSelection()
        triggerRefresh()
      }
      setShowDisableConfirm(false)
    } catch (_error) {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsDisabling(false)
    }
  }

  const handleBatchVerifyEmail = async () => {
    if (verifyTargets.length === 0) {
      toast.info(t('No selected users can be verified'))
      setShowVerifyConfirm(false)
      return
    }

    setIsVerifying(true)
    try {
      const result = await batchVerifyEmails(
        verifyTargets.map((user) => user.id)
      )
      if (result.success) {
        toast.success(
          t('Successfully verified {{count}} user(s)', {
            count: verifyTargets.length,
          })
        )
        table.resetRowSelection()
        triggerRefresh()
      } else {
        toast.error(result.message || t(ERROR_MESSAGES.UNEXPECTED))
      }
      setShowVerifyConfirm(false)
    } catch (_error) {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={() => setShowVerifyConfirm(true)}
                className='size-8'
                disabled={isVerifying || verifyTargets.length === 0}
                aria-label={t('Verify email of selected users')}
                title={t('Verify email of selected users')}
              />
            }
          >
            {isVerifying ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <ShieldCheck className='size-4' />
            )}
            <span className='sr-only'>
              {t('Verify email of selected users')}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Verify email of selected users')}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={() => setShowDisableConfirm(true)}
                className='size-8'
                disabled={isDisabling || disableTargets.length === 0}
                aria-label={t('Disable selected users')}
                title={t('Disable selected users')}
              />
            }
          >
            {isDisabling ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <PowerOff className='size-4' />
            )}
            <span className='sr-only'>{t('Disable selected users')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Disable selected users')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <ConfirmDialog
        destructive
        open={showDisableConfirm}
        onOpenChange={setShowDisableConfirm}
        handleConfirm={handleBatchDisable}
        isLoading={isDisabling}
        className='max-w-md'
        title={t('Disable Selected Users?')}
        desc={t(
          'This will disable {{count}} selected user(s). Root, already disabled, and deleted users will be skipped.',
          { count: disableTargets.length }
        )}
        confirmText={t('Disable')}
      />

      <ConfirmDialog
        open={showVerifyConfirm}
        onOpenChange={setShowVerifyConfirm}
        handleConfirm={handleBatchVerifyEmail}
        isLoading={isVerifying}
        className='max-w-md'
        title={t('Verify Selected Users?')}
        desc={t(
          'This will pass email verification for {{count}} selected user(s). Deleted users will be skipped.',
          { count: verifyTargets.length }
        )}
        confirmText={t('Verify')}
      />
    </>
  )
}
