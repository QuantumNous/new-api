import { Shield, Key, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDialogs } from '@/hooks/use-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserProfile } from '../types'
import { AccessTokenDialog } from './dialogs/access-token-dialog'
import { ChangePasswordDialog } from './dialogs/change-password-dialog'
import { DeleteAccountDialog } from './dialogs/delete-account-dialog'

// ============================================================================
// Profile Security Card Component
// ============================================================================

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
      <Card className='overflow-hidden'>
        <CardHeader className='border-b'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-3 pt-6'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!profile) return null

  const securityActions = [
    {
      icon: Shield,
      title: t('Change Password'),
      description: t('Update your password to keep your account secure'),
      action: () => dialogs.open('password'),
      variant: 'default' as const,
    },
    {
      icon: Key,
      title: t('Access Token'),
      description: t('Generate and manage your API access token'),
      action: () => dialogs.open('token'),
      variant: 'default' as const,
    },
    {
      icon: Trash2,
      title: t('Delete Account'),
      description: t('Permanently delete your account and all data'),
      action: () => dialogs.open('delete'),
      variant: 'destructive' as const,
    },
  ]

  return (
    <>
      <Card className='overflow-hidden'>
        <CardHeader className='border-b'>
          <div className='flex items-center gap-3'>
            <div className='bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
              <Shield className='h-4 w-4' />
            </div>
            <div className='min-w-0'>
              <CardTitle className='text-xl tracking-tight'>
                {t('Security')}
              </CardTitle>
              <CardDescription>
                {t('Manage your security settings and account access')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className='pt-6'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            {securityActions.map((item) => (
              <button
                key={item.title}
                type='button'
                onClick={item.action}
                className={`hover:bg-muted/50 flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors ${
                  item.variant === 'destructive'
                    ? 'border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5'
                    : ''
                }`}
              >
                <div
                  className={`rounded-md p-2 ${
                    item.variant === 'destructive'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted'
                  }`}
                >
                  <item.icon className='h-5 w-5' />
                </div>
                <p className='text-sm font-medium'>{item.title}</p>
                <p className='text-muted-foreground text-xs'>
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
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
