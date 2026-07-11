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
import { Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
} from '@/components/design-system/alert-dialog'
import { Button } from '@/components/design-system/button'
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePasskeyManagement } from '@/features/auth/passkey'
import {
  SecureVerificationDialog,
  useSecureVerification,
  type VerificationMethod,
  type VerificationMethods,
} from '@/features/auth/secure-verification'
import dayjs from '@/lib/dayjs'

interface PasskeyRowProps {
  loading: boolean
}

export function PasskeyRow({ loading: pageLoading }: PasskeyRowProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [restrictedMethod, setRestrictedMethod] =
    useState<VerificationMethod | null>(null)

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
      // Without 2FA enabled, register directly. The browser-level Passkey prompt
      // is itself a strong proof of presence, so no extra verification is needed.
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

  const handleRemove = useCallback(async () => {
    const methods = await fetchVerificationMethods()
    let required: VerificationMethod | null = null
    if (methods.has2FA) {
      required = '2fa'
    } else if (methods.hasPasskey) {
      required = 'passkey'
    }

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

    setConfirmOpen(false)
    setRestrictedMethod(required)
    await startVerification(remove, {
      preferredMethod: required,
      title: t('Security verification'),
      description: t(
        'Confirm your identity before removing this Passkey from your account.'
      ),
    })
  }, [fetchVerificationMethods, remove, startVerification, t])

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

  // Adapt the hook's `Promise<unknown>` return into the dialog's
  // `void | Promise<void>` signature without losing error propagation
  // semantics (errors are surfaced via toast inside the hook).
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
      <div className='space-y-2 py-4 first:pt-0 last:pb-0'>
        <Skeleton className='h-5 w-48' />
        <Skeleton className='h-4 w-64' />
      </div>
    )
  }

  const formattedLastUsed =
    lastUsed && !Number.isNaN(Date.parse(lastUsed))
      ? dayjs(lastUsed).fromNow()
      : t('Not used yet')

  const showUnsupportedNotice = !supported && !enabled
  let backupStatus: {
    label: string
    variant: 'success' | 'warning' | 'neutral'
  } | null = null

  if (status?.backup_eligible !== undefined) {
    backupStatus = {
      label: t('No backup'),
      variant: 'neutral',
    }

    if (status.backup_eligible) {
      backupStatus = {
        label: status.backup_state ? t('Backed up') : t('Not backed up'),
        variant: status.backup_state ? 'success' : 'warning',
      }
    }
  }

  return (
    <>
      <div className='flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0 space-y-0.5'>
          <div className='flex flex-wrap items-center gap-2'>
            <p className='text-sm font-medium'>{t('Passkey')}</p>
            <StatusBadge variant={enabled ? 'success' : 'neutral'}>
              {enabled ? t('Enabled') : t('Disabled')}
            </StatusBadge>
            {backupStatus && (
              <StatusBadge variant={backupStatus.variant}>
                {backupStatus.label}
              </StatusBadge>
            )}
          </div>
          <p className='text-muted-foreground text-xs sm:text-sm'>
            {enabled
              ? `${t('Last used:')} ${formattedLastUsed}`
              : t('Use Passkey to sign in without entering your password.')}
          </p>
          {showUnsupportedNotice && (
            <p className='text-muted-foreground text-xs'>
              {t(
                'Use a compatible browser or device with biometric authentication or a security key to register a Passkey.'
              )}
            </p>
          )}
        </div>

        <div className='flex shrink-0 flex-wrap items-center gap-2'>
          {enabled ? (
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant='outline'
                    className='text-destructive hover:text-destructive'
                    disabled={removing}
                  />
                }
              >
                {removing && <Loader2 className='mr-2 size-4 animate-spin' />}
                {t('Remove Passkey')}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Remove Passkey?')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      'Removing Passkey will require you to sign in with your password next time. You can re-register anytime.'
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={removing}>
                    {t('Cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant='destructive'
                    disabled={removing}
                    onClick={(event) => {
                      event.preventDefault()
                      handleRemove()
                    }}
                  >
                    {t('Remove')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant='outline'
              onClick={handleRegister}
              disabled={!supported || registering}
            >
              {registering && <Loader2 className='mr-2 size-4 animate-spin' />}
              {t('Enable Passkey')}
            </Button>
          )}
        </div>
      </div>

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
