import { Shield, Key, Trash2 } from 'lucide-react'
import { useDialogs } from '@/hooks/use-dialogs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  const dialogs = useDialogs<DialogKey>()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-3'>
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
      title: 'Change Password',
      description: 'Update your password to keep your account secure',
      action: () => dialogs.open('password'),
      variant: 'default' as const,
    },
    {
      icon: Key,
      title: 'Access Token',
      description: 'Generate and manage your API access token',
      action: () => dialogs.open('token'),
      variant: 'default' as const,
    },
    {
      icon: Trash2,
      title: 'Delete Account',
      description: 'Permanently delete your account and all data',
      action: () => dialogs.open('delete'),
      variant: 'destructive' as const,
    },
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <h3 className='text-xl font-semibold tracking-tight'>Security</h3>
          <p className='text-muted-foreground mt-2 text-sm'>
            Manage your security settings and account access
          </p>
        </CardHeader>

        <CardContent className='space-y-3'>
          {securityActions.map((item) => (
            <div
              key={item.title}
              className='hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 transition-colors'
            >
              <div className='flex items-center gap-4'>
                <div className='bg-muted rounded-md p-2'>
                  <item.icon className='h-5 w-5' />
                </div>
                <div>
                  <p className='font-medium'>{item.title}</p>
                  <p className='text-muted-foreground text-sm'>
                    {item.description}
                  </p>
                </div>
              </div>
              <Button variant={item.variant} size='sm' onClick={item.action}>
                {item.variant === 'destructive' ? 'Delete' : 'Manage'}
              </Button>
            </div>
          ))}
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
