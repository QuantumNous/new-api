import { useMemo } from 'react'
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  SecureVerificationState,
  VerificationMethod,
  VerificationMethods,
} from '../types'

interface SecureVerificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  methods: VerificationMethods
  state: SecureVerificationState
  onVerify: (method: VerificationMethod, code?: string) => void | Promise<void>
  onCancel: () => void
  onCodeChange: (code: string) => void
  onMethodChange: (method: VerificationMethod) => void
}

export function SecureVerificationDialog({
  open,
  onOpenChange,
  methods,
  state,
  onVerify,
  onCancel,
  onCodeChange,
  onMethodChange,
}: SecureVerificationDialogProps) {
  const { t } = useTranslation()
  const availableTabs: VerificationMethod[] = useMemo(() => {
    const tabs: VerificationMethod[] = []
    if (methods.has2FA) tabs.push('2fa')
    if (methods.hasPasskey && methods.passkeySupported) tabs.push('passkey')
    return tabs
  }, [methods])

  const activeMethod =
    state.method ?? (availableTabs.length > 0 ? availableTabs[0] : null)

  const title =
    state.title ??
    (availableTabs.length
      ? 'Additional verification required'
      : 'Verification unavailable')

  const description =
    state.description ??
    (availableTabs.length
      ? 'Confirm your identity before accessing this sensitive action.'
      : 'Enable Two-factor Authentication or Passkey in your profile settings to continue.')

  const handleVerify = () => {
    if (!activeMethod) return
    const payload = activeMethod === '2fa' ? state.code : undefined
    onVerify(activeMethod, payload)
  }

  const verifyDisabled =
    state.loading ||
    (activeMethod === '2fa' && (!state.code.trim() || state.code.length < 6))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='top-[8vh] max-w-[calc(100%-1.5rem)] translate-y-0 gap-0 overflow-hidden border-none p-0 shadow-xl sm:top-1/2 sm:max-w-md sm:translate-y-[-50%] sm:rounded-xl'
        showCloseButton={!state.loading}
      >
        <div className='bg-background flex max-h-[calc(100dvh-2rem)] flex-col'>
          <DialogHeader className='border-b px-6 py-5 text-left'>
            <DialogTitle className='flex items-center gap-2 text-lg font-semibold'>
              <ShieldCheck className='text-primary h-5 w-5' />
              {title}
            </DialogTitle>
            <DialogDescription className='text-left'>
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className='flex-1 overflow-y-auto px-6 py-5'>
            {availableTabs.length === 0 ? (
              <div className='grid place-items-center gap-4 text-center'>
                <div className='bg-muted flex h-16 w-16 items-center justify-center rounded-full'>
                  <ShieldCheck className='text-muted-foreground h-8 w-8' />
                </div>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Enable Two-factor Authentication or Passkey in your profile to unlock sensitive operations.'
                  )}
                </p>
              </div>
            ) : (
              <Tabs
                value={activeMethod ?? availableTabs[0]}
                onValueChange={(value) =>
                  onMethodChange(value as VerificationMethod)
                }
                className='gap-4'
              >
                <TabsList>
                  {methods.has2FA && (
                    <TabsTrigger value='2fa'>
                      {t('Authenticator code')}
                    </TabsTrigger>
                  )}
                  {methods.hasPasskey && methods.passkeySupported && (
                    <TabsTrigger value='passkey'>{t('Passkey')}</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value='2fa' className='space-y-3'>
                  <p className='text-muted-foreground text-sm'>
                    {t(
                      'Enter the 6-digit Time-based One-Time Password or 8-character backup code from your authenticator app.'
                    )}
                  </p>
                  <Input
                    inputMode='numeric'
                    maxLength={8}
                    value={state.code}
                    onChange={(event) => onCodeChange(event.target.value)}
                    placeholder={t('Enter verification code')}
                    disabled={state.loading}
                    autoFocus={activeMethod === '2fa'}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !verifyDisabled) {
                        event.preventDefault()
                        handleVerify()
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value='passkey' className='space-y-4'>
                  <div className='bg-muted/50 flex items-center justify-center rounded-lg p-4'>
                    <div className='text-muted-foreground flex items-center gap-3'>
                      <KeyRound className='text-primary h-6 w-6' />
                      <div className='text-left text-sm'>
                        <p className='text-foreground font-medium'>
                          {t('Use your Passkey')}
                        </p>
                        <p>
                          {t(
                            'We will prompt your device to confirm using biometrics or your hardware key.'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!methods.passkeySupported && (
                    <p className='text-destructive text-sm'>
                      {t('This device does not support Passkey verification.')}
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          <DialogFooter className='bg-muted/30 border-t px-6 py-4 sm:flex-row sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              disabled={state.loading}
              onClick={onCancel}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              onClick={handleVerify}
              disabled={availableTabs.length === 0 || verifyDisabled}
            >
              {state.loading && <Loader2 className='h-4 w-4 animate-spin' />}
              {t('Verify')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
