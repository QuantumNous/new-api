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
import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import dayjs from '@/lib/dayjs'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { usePasskeyManagement } from '@/features/auth/passkey'
import {
  SecureVerificationDialog,
  useSecureVerification,
  type VerificationMethod,
  type VerificationMethods,
} from '@/features/auth/secure-verification'

interface PasskeyCardProps {
  loading: boolean
}

export function PasskeyCard({ loading: pageLoading }: PasskeyCardProps) {
  const { t } = useTranslation()
  const [confirmCredentialId, setConfirmCredentialId] = useState<string | null>(
    null
  )
  const [restrictedMethod, setRestrictedMethod] =
    useState<VerificationMethod | null>(null)

  const {
    status,
    loading,
    registering,
    removing,
    supported,
    enabled,
    credentials,
    register,
    remove,
  } = usePasskeyManagement()

  const {
    open: verificationOpen,
    setOpen: setVerificationOpen,
    methods: verificationMethods,
    state: verificationState,
    startVerification,
    executeVerification,
    cancel: cancelVerification,
    setCode,
    switchMethod,
    fetchVerificationMethods,
  } = useSecureVerification({
    onSuccess: () => {
      setRestrictedMethod(null)
    },
  })

  const dialogMethods = useMemo<VerificationMethods>(() => {
    if (!restrictedMethod) return verificationMethods
    return {
      ...verificationMethods,
      has2FA: restrictedMethod === '2fa' && verificationMethods.has2FA,
      hasPasskey:
        restrictedMethod === 'passkey' && verificationMethods.hasPasskey,
    }
  }, [restrictedMethod, verificationMethods])

  const handleRegister = useCallback(async () => {
    if (!supported) {
      toast.info(t('This device does not support Passkey'))
      return
    }

    const methods = await fetchVerificationMethods()
    if (!methods.has2FA) {
      await register()
      return
    }

    setRestrictedMethod('2fa')
    await startVerification(register, {
      preferredMethod: '2fa',
      title: t('Security verification'),
      description: t(
        'Confirm your identity with Two-factor Authentication before registering a Passkey.'
      ),
    })
  }, [fetchVerificationMethods, register, startVerification, supported, t])

  const handleRemove = useCallback(
    async (credentialId: string) => {
      const methods = await fetchVerificationMethods()
      const required: VerificationMethod | null = methods.has2FA
        ? '2fa'
        : methods.hasPasskey
          ? 'passkey'
          : null

      if (!required) {
        toast.error(
          t(
            'Please enable Two-factor Authentication or Passkey before proceeding'
          )
        )
        return
      }

      if (required === 'passkey' && !methods.passkeySupported) {
        toast.info(t('This device does not support Passkey'))
        return
      }

      setConfirmCredentialId(null)
      setRestrictedMethod(required)
      await startVerification(() => remove(credentialId), {
        preferredMethod: required,
        title: t('Security verification'),
        description: t(
          'Confirm your identity before removing this Passkey from your account.'
        ),
      })
    },
    [fetchVerificationMethods, remove, startVerification, t]
  )

  const handleVerificationCancel = useCallback(() => {
    setRestrictedMethod(null)
    cancelVerification()
  }, [cancelVerification])

  const handleVerificationOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setRestrictedMethod(null)
      }
      setVerificationOpen(next)
    },
    [setVerificationOpen]
  )

  const handleDialogVerify = useCallback(
    async (method: VerificationMethod, code?: string) => {
      try {
        await executeVerification(method, code)
      } catch {
        // Errors are already surfaced by useSecureVerification via toast.
      }
    },
    [executeVerification]
  )

  if (pageLoading || loading) {
    return (
      <Card className='gap-0 overflow-hidden py-0'>
        <CardHeader className='p-3 sm:p-5'>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='mt-2 h-4 w-64' />
        </CardHeader>
        <CardContent className='p-3 sm:p-5'>
          <Skeleton className='h-20 w-full' />
        </CardContent>
      </Card>
    )
  }

  const showUnsupportedNotice = !supported && !enabled

  return (
    <>
      <Card className='gap-0 overflow-hidden py-0'>
        <CardHeader className='p-3 sm:p-5'>
          <CardTitle className='text-lg tracking-tight sm:text-xl'>
            {t('Passkey Login')}
          </CardTitle>
          <CardDescription className='text-xs sm:text-sm'>
            {t('Use Passkey to sign in without entering your password.')}
          </CardDescription>
        </CardHeader>

        <CardContent className='p-3 sm:p-5'>
          <div className='space-y-6'>
            {!enabled && (
              <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:flex-col 2xl:flex-row'>
                <div className='flex items-start gap-4'>
                  <div className='bg-muted rounded-md p-2'>
                    <KeyRound className='h-5 w-5' />
                  </div>
                  <div className='space-y-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='font-medium'>{t('Passkey Authentication')}</p>
                      <StatusBadge
                        label={t('Disabled')}
                        variant='neutral'
                        showDot
                        copyable={false}
                      />
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      {t('No Passkeys registered')}
                    </p>
                  </div>
                </div>

                <Button
                  className='w-full sm:w-auto xl:w-full 2xl:w-auto'
                  onClick={handleRegister}
                  disabled={!supported || registering}
                >
                  {registering && (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  {t('Enable Passkey')}
                </Button>
              </div>
            )}

            {enabled && (
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='bg-muted rounded-md p-2'>
                      <KeyRound className='h-5 w-5' />
                    </div>
                    <p className='font-medium'>
                      {t('Registered Passkeys')} ({credentials.length})
                    </p>
                  </div>
                  <Button
                    size='sm'
                    onClick={handleRegister}
                    disabled={!supported || registering}
                  >
                    {registering && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    {t('Add Passkey')}
                  </Button>
                </div>

                <div className='space-y-3'>
                  {credentials.map((cred) => (
                    <PasskeyCredentialItem
                      key={cred.credential_id}
                      credential={cred}
                      removing={removing === cred.credential_id}
                      onRemove={() => setConfirmCredentialId(cred.credential_id)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}

            {showUnsupportedNotice && (
              <div className='bg-muted/60 text-muted-foreground flex items-start gap-3 rounded-md p-4 text-sm'>
                <ShieldAlert className='mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500' />
                <div>
                  <p className='text-foreground font-medium'>
                    {t('Passkey not supported on this device')}
                  </p>
                  <p>
                    {t(
                      'Use a compatible browser or device with biometric authentication or a security key to register a Passkey.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={confirmCredentialId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCredentialId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Remove Passkey?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Removing this Passkey will prevent sign-in with this device. You can re-register anytime.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={removing === confirmCredentialId}
              onClick={() => setConfirmCredentialId(null)}
            >
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={removing === confirmCredentialId}
              onClick={(event) => {
                event.preventDefault()
                if (confirmCredentialId) {
                  handleRemove(confirmCredentialId)
                }
              }}
            >
              {t('Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SecureVerificationDialog
        open={verificationOpen}
        onOpenChange={handleVerificationOpenChange}
        methods={dialogMethods}
        state={verificationState}
        onVerify={handleDialogVerify}
        onCancel={handleVerificationCancel}
        onCodeChange={setCode}
        onMethodChange={switchMethod}
      />
    </>
  )
}

function PasskeyCredentialItem({
  credential,
  removing,
  onRemove,
  t,
}: {
  credential: {
    credential_id: string
    created_at: string
    last_used_at?: string | null
    backup_eligible?: boolean
    backup_state?: boolean
    attachment?: string
  }
  removing: boolean
  onRemove: () => void
  t: (key: string) => string
}) {
  const formattedLastUsed =
    credential.last_used_at && !Number.isNaN(Date.parse(credential.last_used_at))
      ? dayjs(credential.last_used_at).fromNow()
      : t('Not used yet')

  const deviceType =
    credential.attachment === 'platform'
      ? t('Built-in Device')
      : credential.attachment === 'cross-platform'
        ? t('External Device')
        : t('Unknown Device')

  return (
    <div className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
      <div className='space-y-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='font-medium'>{deviceType}</p>
          {credential.backup_eligible !== undefined && (
            <StatusBadge
              label={
                credential.backup_eligible
                  ? credential.backup_state
                    ? t('Backed up')
                    : t('Not backed up')
                  : t('No backup')
              }
              variant={
                credential.backup_eligible
                  ? credential.backup_state
                    ? 'success'
                    : 'warning'
                  : 'neutral'
              }
              showDot
              copyable={false}
              size='sm'
            />
          )}
        </div>
        <div className='text-muted-foreground text-xs space-y-0.5'>
          <p>
            {t('Last used:')} {formattedLastUsed}
          </p>
          <p>
            {t('Created:')}{' '}
            {dayjs(credential.created_at).format('YYYY-MM-DD HH:mm')}
          </p>
        </div>
      </div>

      <Button
        variant='destructive'
        size='sm'
        className='w-full sm:w-auto'
        disabled={removing}
        onClick={onRemove}
      >
        {removing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
        <AlertTriangle className='mr-2 h-4 w-4' />
        {t('Remove')}
      </Button>
    </div>
  )
}
