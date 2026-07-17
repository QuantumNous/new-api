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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { useDialogs } from '@/hooks/use-dialog'

import type { UserProfile } from '../types'
import { AccessTokenDialog } from './dialogs/access-token-dialog'
import { ChangePasswordDialog } from './dialogs/change-password-dialog'
import { DeleteAccountDialog } from './dialogs/delete-account-dialog'
import { PasskeyRow } from './passkey-row'
import { TwoFARow } from './two-fa-row'

interface ProfileSecurityCardProps {
  profile: UserProfile | null
  loading: boolean
}

type DialogKey = 'password' | 'token' | 'delete'

export function ProfileSecurityCard({
  profile,
  loading,
}: ProfileSecurityCardProps) {
  const { t } = useTranslation()
  const dialogs = useDialogs<DialogKey>()

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-4 !pb-4 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-56' />
        </CardHeader>
        <CardContent className='divide-border/60 divide-y p-4 sm:p-5'>
          {['password', 'token', 'twofa', 'passkey'].map((key) => (
            <div key={key} className='space-y-2 py-4 first:pt-0 last:pb-0'>
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-4 w-64' />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!profile) return null

  return (
    <>
      <TitledCard
        title={t('Security')}
        description={t('Manage your security settings and account access')}
        disableHoverEffect
      >
        <div className='divide-border/60 divide-y'>
          <div className='flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0 space-y-0.5'>
              <p className='text-sm font-medium'>{t('Password')}</p>
              <p className='text-muted-foreground text-xs sm:text-sm'>
                {t('Update your password to keep your account secure')}
              </p>
            </div>
            <Button
              variant='outline'
              className='shrink-0 self-start sm:self-auto'
              onClick={() => dialogs.open('password')}
            >
              {t('Change Password')}
            </Button>
          </div>

          <div className='flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0 space-y-0.5'>
              <p className='text-sm font-medium'>{t('Access Token')}</p>
              <p className='text-muted-foreground text-xs sm:text-sm'>
                {t('Generate and manage your API access token')}
              </p>
            </div>
            <Button
              variant='outline'
              className='shrink-0 self-start sm:self-auto'
              onClick={() => dialogs.open('token')}
            >
              {t('Manage')}
            </Button>
          </div>

          <TwoFARow loading={loading} />

          <PasskeyRow loading={loading} />
        </div>
      </TitledCard>

      <Card
        data-card-hover='false'
        className='ring-destructive/30 gap-0 overflow-hidden py-0'
      >
        <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5'>
          <div className='min-w-0 space-y-0.5'>
            <p className='text-sm font-medium'>{t('Delete Account')}</p>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              {t('Permanently delete your account and all data')}
            </p>
          </div>
          <Button
            variant='destructive'
            className='shrink-0 self-start sm:self-auto'
            onClick={() => dialogs.open('delete')}
          >
            {t('Delete Account')}
          </Button>
        </CardContent>
      </Card>

      <ChangePasswordDialog
        open={dialogs.isOpen('password')}
        onOpenChange={(open) =>
          open ? dialogs.open('password') : dialogs.close('password')
        }
        username={profile.username}
      />

      <AccessTokenDialog
        open={dialogs.isOpen('token')}
        onOpenChange={(open) =>
          open ? dialogs.open('token') : dialogs.close('token')
        }
      />

      <DeleteAccountDialog
        open={dialogs.isOpen('delete')}
        onOpenChange={(open) =>
          open ? dialogs.open('delete') : dialogs.close('delete')
        }
        username={profile.username}
      />
    </>
  )
}
