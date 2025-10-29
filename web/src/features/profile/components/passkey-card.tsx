import { useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { KeyRound, ShieldAlert, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { usePasskeyManagement } from '@/features/auth/passkey'

interface PasskeyCardProps {
  loading: boolean
}

export function PasskeyCard({ loading: pageLoading }: PasskeyCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const {
    status,
    loading,
    registering,
    removing,
    supported,
    enabled,
    lastUsed,
    register,
    remove,
  } = usePasskeyManagement()

  if (pageLoading || loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='mt-2 h-4 w-64' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
        </CardContent>
      </Card>
    )
  }

  const formattedLastUsed =
    lastUsed && !Number.isNaN(Date.parse(lastUsed))
      ? formatDistanceToNowStrict(new Date(lastUsed), { addSuffix: true })
      : 'Not used yet'

  const showUnsupportedNotice = !supported && !enabled

  return (
    <>
      <Card>
        <CardHeader>
          <h3 className='text-xl font-semibold tracking-tight'>
            Passkey Login
          </h3>
          <p className='text-muted-foreground mt-2 text-sm'>
            Use Passkey to sign in without entering your password.
          </p>
        </CardHeader>

        <CardContent className='space-y-6'>
          <div className='flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-start gap-3'>
              <div className='bg-muted rounded-md p-2'>
                <KeyRound className='h-5 w-5' />
              </div>
              <div className='space-y-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='font-medium'>Passkey Authentication</p>
                  <StatusBadge
                    label={enabled ? 'Enabled' : 'Disabled'}
                    variant={enabled ? 'success' : 'neutral'}
                    showDot
                    copyable={false}
                  />
                  {status?.backup_eligible !== undefined && (
                    <StatusBadge
                      label={
                        status.backup_eligible
                          ? status.backup_state
                            ? 'Backed up'
                            : 'Not backed up'
                          : 'No backup'
                      }
                      variant={
                        status.backup_eligible
                          ? status.backup_state
                            ? 'success'
                            : 'warning'
                          : 'neutral'
                      }
                      showDot
                      copyable={false}
                    />
                  )}
                </div>
                <p className='text-muted-foreground text-sm'>
                  Last used: {formattedLastUsed}
                </p>
              </div>
            </div>

            {!enabled ? (
              <Button
                className='w-full sm:w-auto'
                onClick={() => register()}
                disabled={!supported || registering}
              >
                {registering && (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                )}
                Register Passkey
              </Button>
            ) : (
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='outline'
                    className='w-full sm:w-auto'
                    disabled={removing}
                  >
                    Remove Passkey
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Passkey?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removing Passkey will require you to sign in with your
                      password next time. You can re-register anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={removing}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      disabled={removing}
                      onClick={async () => {
                        const success = await remove()
                        if (success) {
                          setConfirmOpen(false)
                        }
                      }}
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {showUnsupportedNotice && (
            <div className='bg-muted/60 text-muted-foreground flex items-start gap-3 rounded-md p-4 text-sm'>
              <ShieldAlert className='mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500' />
              <div>
                <p className='text-foreground font-medium'>
                  Passkey not supported on this device
                </p>
                <p>
                  Use a compatible browser or device with biometric
                  authentication or a security key to register a Passkey.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
