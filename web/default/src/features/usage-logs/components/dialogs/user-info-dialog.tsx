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
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatCompactNumber } from '@/lib/format'
import { formatUsageLogQuotaDisplay } from '@/lib/ops-billing-display'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  usageLogsDialogContentPanelClassName,
  usageLogsDialogContentTextClassName,
  usageLogsDialogLabelClassName,
  usageLogsDialogSectionLabelClassName,
  usageLogsDialogTitleClassName,
  usageLogsDialogValueClassName,
} from '../../lib/ops-ui-styles'
import { getUserInfo } from '../../api'
import type { UserInfo } from '../../types'

interface UserInfoDialogProps {
  userId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserInfoDialog({
  userId,
  open,
  onOpenChange,
}: UserInfoDialogProps) {
  const { t } = useTranslation()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchUserInfo = useCallback(async (id: number) => {
    setIsLoading(true)
    try {
      const result = await getUserInfo(id)
      if (result.success) {
        setUserInfo(result.data || null)
      } else {
        if (result.message) {
          // eslint-disable-next-line no-console
          console.warn('getUserInfo failed:', result.message)
        }
        toast.error(t('usageLogs.userDialog.toast.fetch_failed'))
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user info:', error)
      toast.error(t('usageLogs.userDialog.toast.fetch_failed'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (open && userId) {
      fetchUserInfo(userId)
    }
  }, [open, userId, fetchUserInfo])

  const InfoItem = ({
    label,
    value,
  }: {
    label: string
    value: string | number
  }) => (
    <div className='space-y-1.5'>
      <Label className={usageLogsDialogLabelClassName}>{label}</Label>
      <div className={cn('font-semibold', usageLogsDialogValueClassName)}>
        {value}
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className={usageLogsDialogTitleClassName}>
            {t('usageLogs.userDialog.title')}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            {t('usageLogs.userDialog.description')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='size-6 animate-spin text-slate-500' />
          </div>
        ) : userInfo ? (
          <div className='space-y-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <InfoItem
                label={t('usageLogs.userDialog.username')}
                value={userInfo.username}
              />
              {userInfo.display_name && (
                <InfoItem
                  label={t('usageLogs.userDialog.display_name')}
                  value={userInfo.display_name}
                />
              )}
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <InfoItem
                label={t('usageLogs.userDialog.available_quota')}
                value={formatUsageLogQuotaDisplay(userInfo.quota)}
              />
              <InfoItem
                label={t('usageLogs.userDialog.used_quota')}
                value={formatUsageLogQuotaDisplay(userInfo.used_quota)}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <InfoItem
                label={t('usageLogs.userDialog.request_count')}
                value={formatCompactNumber(userInfo.request_count)}
              />
              {userInfo.group && (
                <InfoItem
                  label={t('usageLogs.userDialog.group')}
                  value={userInfo.group}
                />
              )}
            </div>

            {(userInfo.aff_code ||
              userInfo.aff_count !== undefined ||
              (userInfo.aff_quota !== undefined && userInfo.aff_quota > 0)) && (
              <>
                <div className='grid grid-cols-2 gap-4'>
                  {userInfo.aff_code && (
                    <InfoItem
                      label={t('usageLogs.userDialog.invitation_code')}
                      value={userInfo.aff_code}
                    />
                  )}
                  {userInfo.aff_count !== undefined && (
                    <InfoItem
                      label={t('usageLogs.userDialog.invited_count')}
                      value={formatCompactNumber(userInfo.aff_count)}
                    />
                  )}
                </div>

                {userInfo.aff_quota !== undefined && userInfo.aff_quota > 0 && (
                  <InfoItem
                    label={t('usageLogs.userDialog.invitation_quota')}
                    value={formatUsageLogQuotaDisplay(userInfo.aff_quota)}
                  />
                )}
              </>
            )}

            {userInfo.remark && (
              <div className='space-y-1.5'>
                <Label className={usageLogsDialogSectionLabelClassName}>
                  {t('usageLogs.userDialog.remark')}
                </Label>
                <div
                  className={cn(
                    usageLogsDialogContentPanelClassName,
                    'py-2.5'
                  )}
                >
                  <p
                    className={cn(
                      'leading-relaxed break-words',
                      usageLogsDialogContentTextClassName,
                      'pr-0'
                    )}
                  >
                    {userInfo.remark}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className='py-8 text-center text-sm text-slate-600'>
            {t('usageLogs.userDialog.empty')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
