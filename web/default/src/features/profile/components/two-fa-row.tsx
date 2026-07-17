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
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useDialogs } from '@/hooks/use-dialog'

import { useTwoFA } from '../hooks'
import { TwoFABackupDialog } from './dialogs/two-fa-backup-dialog'
import { TwoFADisableDialog } from './dialogs/two-fa-disable-dialog'
import { TwoFASetupDialog } from './dialogs/two-fa-setup-dialog'

interface TwoFARowProps {
  loading: boolean
}

type DialogKey = 'setup' | 'disable' | 'backup'

export function TwoFARow({ loading: pageLoading }: TwoFARowProps) {
  const { t } = useTranslation()
  const { status, loading, refetch } = useTwoFA(!pageLoading)
  const dialogs = useDialogs<DialogKey>()

  if (pageLoading || loading) {
    return (
      <div className='space-y-2 py-4 first:pt-0 last:pb-0'>
        <Skeleton className='h-5 w-56' />
        <Skeleton className='h-4 w-72' />
      </div>
    )
  }

  return (
    <>
      <div className='flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0 space-y-0.5'>
          <div className='flex flex-wrap items-center gap-2'>
            <p className='text-sm font-medium'>
              {t('Two-Factor Authentication')}
            </p>
            <StatusBadge variant={status.enabled ? 'success' : 'neutral'}>
              {status.enabled ? t('Enabled') : t('Disabled')}
            </StatusBadge>
            {status.locked && (
              <StatusBadge variant='destructive'>{t('Locked')}</StatusBadge>
            )}
          </div>
          <p className='text-muted-foreground text-xs sm:text-sm'>
            {status.enabled
              ? t('Backup codes remaining: {{count}}', {
                  count: status.backup_codes_remaining,
                })
              : t('Add an extra layer of security to your account')}
          </p>
        </div>

        <div className='flex shrink-0 flex-wrap items-center gap-2'>
          {status.enabled ? (
            <>
              <Button variant='outline' onClick={() => dialogs.open('backup')}>
                {t('Regenerate Backup Codes')}
              </Button>
              <Button
                variant='outline'
                className='text-destructive hover:text-destructive'
                onClick={() => dialogs.open('disable')}
              >
                {t('Disable 2FA')}
              </Button>
            </>
          ) : (
            <Button variant='outline' onClick={() => dialogs.open('setup')}>
              {t('Enable')}
            </Button>
          )}
        </div>
      </div>

      <TwoFASetupDialog
        open={dialogs.isOpen('setup')}
        onOpenChange={(open) =>
          open ? dialogs.open('setup') : dialogs.close('setup')
        }
        onSuccess={refetch}
      />

      <TwoFADisableDialog
        open={dialogs.isOpen('disable')}
        onOpenChange={(open) =>
          open ? dialogs.open('disable') : dialogs.close('disable')
        }
        onSuccess={refetch}
      />

      <TwoFABackupDialog
        open={dialogs.isOpen('backup')}
        onOpenChange={(open) =>
          open ? dialogs.open('backup') : dialogs.close('backup')
        }
        onSuccess={refetch}
      />
    </>
  )
}
