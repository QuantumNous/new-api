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
import { api } from '@/lib/api'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface UserInfo {
  id: number
  username?: string
  display_name?: string
  email?: string
  quota?: number
  used_quota?: number
  request_count?: number
  group?: string
  aff_code?: string
  aff_count?: number
  aff_quota?: number
  aff_ratio_override?: number | null
  aff_ratio_snapshot?: number | null
  remark?: string
}

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

  const fetchUserInfo = useCallback(
    async (id: number) => {
      setIsLoading(true)
      try {
        const res = await api.get(`/api/user/${id}`)
        const result = res.data as {
          success: boolean
          message?: string
          data?: UserInfo
        }
        if (result.success) {
          setUserInfo(result.data || null)
        } else {
          toast.error(result.message || t('Failed to fetch user information'))
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch user info:', error)
        toast.error(t('Failed to fetch user information'))
      } finally {
        setIsLoading(false)
      }
    },
    [t]
  )

  useEffect(() => {
    if (open && userId) {
      fetchUserInfo(userId)
    }
  }, [open, userId, fetchUserInfo])

  useEffect(() => {
    if (!open) {
      setUserInfo(null)
    }
  }, [open])

  const renderText = (value?: string | null) => {
    if (!value) return '-'
    return value
  }
  const renderPercent = (value?: number | null, empty = '-') => {
    if (value === null || value === undefined) return empty
    return `${value}%`
  }

  const InfoItem = ({
    label,
    value,
  }: {
    label: string
    value: string | number
  }) => (
    <div className='space-y-1.5'>
      <Label className='text-muted-foreground text-xs'>{label}</Label>
      <div className='text-sm font-semibold'>{value}</div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('User Information')}</DialogTitle>
          <DialogDescription>
            {t(
              'View detailed information about this user including balance, usage statistics, and invitation details.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='text-muted-foreground size-6 animate-spin' />
          </div>
        ) : userInfo ? (
          <div className='space-y-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <InfoItem
                label={t('Username')}
                value={renderText(userInfo.username)}
              />
              <InfoItem label='UID' value={userInfo.id || userId || '-'} />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <InfoItem
                label={t('Display Name')}
                value={renderText(userInfo.display_name)}
              />
              <InfoItem label={t('Email')} value={renderText(userInfo.email)} />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <InfoItem
                label={t('Balance')}
                value={formatQuota(userInfo.quota ?? 0)}
              />
              <InfoItem
                label={t('Used Quota')}
                value={formatQuota(userInfo.used_quota ?? 0)}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <InfoItem
                label={t('Request Count')}
                value={formatCompactNumber(userInfo.request_count ?? 0)}
              />
              <InfoItem
                label={t('User Group')}
                value={renderText(userInfo.group)}
              />
            </div>

            {(userInfo.aff_code ||
              userInfo.aff_count !== undefined ||
              (userInfo.aff_quota !== undefined && userInfo.aff_quota > 0)) && (
              <>
                <div className='grid grid-cols-2 gap-4'>
                  {userInfo.aff_code && (
                    <InfoItem
                      label={t('Invitation Code')}
                      value={userInfo.aff_code}
                    />
                  )}
                  {userInfo.aff_count !== undefined && (
                    <InfoItem
                      label={t('Invited Users')}
                      value={formatCompactNumber(userInfo.aff_count)}
                    />
                  )}
                </div>

                {userInfo.aff_quota !== undefined && userInfo.aff_quota > 0 && (
                  <InfoItem
                    label={t('Invitation Quota')}
                    value={formatQuota(userInfo.aff_quota)}
                  />
                )}
                <div className='grid grid-cols-2 gap-4'>
                  <InfoItem
                    label={t('Commission Ratio Override (%)')}
                    value={renderPercent(
                      userInfo.aff_ratio_override,
                      t('Inherit global setting')
                    )}
                  />
                  <InfoItem
                    label={t('Registered Snapshot Commission Ratio')}
                    value={renderPercent(
                      userInfo.aff_ratio_snapshot,
                      t('No snapshot')
                    )}
                  />
                </div>
              </>
            )}

            {userInfo.remark && (
              <div className='space-y-1.5'>
                <Label className='text-muted-foreground text-xs'>
                  {t('Remark')}
                </Label>
                <div className='text-sm leading-relaxed font-semibold break-words'>
                  {userInfo.remark}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className='text-muted-foreground py-8 text-center text-sm'>
            {t('No user information available')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
