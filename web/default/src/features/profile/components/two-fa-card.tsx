import { Shield, AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDialogs } from '@/hooks/use-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { useTwoFA } from '../hooks'
import { TwoFABackupDialog } from './dialogs/two-fa-backup-dialog'
import { TwoFADisableDialog } from './dialogs/two-fa-disable-dialog'
import { TwoFASetupDialog } from './dialogs/two-fa-setup-dialog'

// ============================================================================
// Two-Factor Authentication Card Component
// ============================================================================

interface TwoFACardProps {
  loading: boolean
}

type DialogKey = 'setup' | 'disable' | 'backup'

export function TwoFACard({ loading: pageLoading }: TwoFACardProps) {
  const { t } = useTranslation()
  const { status, loading, refetch } = useTwoFA(!pageLoading)
  const dialogs = useDialogs<DialogKey>()

  if (pageLoading || loading) {
    return (
      <Card className='overflow-hidden'>
        <CardHeader>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='mt-2 h-4 w-64' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-20 w-full' />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className='overflow-hidden'>
        <CardHeader>
          <CardTitle className='text-xl tracking-tight'>
            {t('Two-Factor Authentication')}
          </CardTitle>
          <CardDescription>
            {t('Add an extra layer of security to your account')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className='space-y-6'>
            {/* Status Section */}
            <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:flex-col 2xl:flex-row'>
              <div className='flex items-start gap-4'>
                <div className='bg-muted rounded-md p-2'>
                  <Shield className='h-5 w-5' />
                </div>
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <p className='font-medium'>{t('Two-Step Verification')}</p>
                    {status.enabled ? (
                      <StatusBadge
                        label={t('Enabled')}
                        variant='success'
                        showDot
                        copyable={false}
                      />
                    ) : (
                      <StatusBadge
                        label={t('Disabled')}
                        variant='neutral'
                        showDot
                        copyable={false}
                      />
                    )}
                    {status.locked && (
                      <StatusBadge
                        label={t('Locked')}
                        variant='danger'
                        showDot
                        copyable={false}
                      />
                    )}
                  </div>
                  <p className='text-muted-foreground text-sm'>
                    {status.enabled
                      ? t('Backup codes remaining: {{count}}', {
                          count: status.backup_codes_remaining,
                        })
                      : t('Add an extra layer of security to your account')}
                  </p>
                </div>
              </div>

              {!status.enabled && (
                <Button
                  className='w-full sm:w-auto xl:w-full 2xl:w-auto'
                  onClick={() => dialogs.open('setup')}
                >
                  {t('Enable')}
                </Button>
              )}
            </div>

            {/* Actions Section - Only show when enabled */}
            {status.enabled && (
              <div className='flex flex-col gap-3 border-t pt-6 sm:flex-row xl:flex-col 2xl:flex-row'>
                <Button
                  variant='outline'
                  className='flex-1'
                  onClick={() => dialogs.open('backup')}
                >
                  <RefreshCw className='mr-2 h-4 w-4' />
                  {t('Regenerate Backup Codes')}
                </Button>
                <Button
                  variant='destructive'
                  className='flex-1'
                  onClick={() => dialogs.open('disable')}
                >
                  <AlertTriangle className='mr-2 h-4 w-4' />
                  {t('Disable 2FA')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
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
