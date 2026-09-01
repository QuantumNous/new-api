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
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { useCountdown } from '@/hooks/use-countdown'

import { sendEmailVerification, bindEmail } from '../../api'

// ============================================================================
// Email Bind Dialog Component
// ============================================================================

interface EmailBindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail?: string
  onSuccess: () => void
}

export function EmailBindDialog({
  open,
  onOpenChange,
  currentEmail,
  onSuccess,
}: EmailBindDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
    reset: resetCountdown,
  } = useCountdown({
    initialSeconds: 60,
  })
  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('')
  }, [setTurnstileToken])
  let sendButtonLabel = t('Send')
  if (isActive) {
    sendButtonLabel = `${secondsLeft}s`
  } else if (sendingCode) {
    sendButtonLabel = t('Sending...')
  }

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      toast.error(t('Please enter a valid email address'))
      return
    }

    if (!validateTurnstile()) return

    try {
      setSendingCode(true)
      const response = await sendEmailVerification(email, turnstileToken)

      if (response.success) {
        toast.success(t('Verification code sent! Please check your email.'))
        startCountdown()
      } else {
        toast.error(response.message || t('Failed to send verification code'))
      }
    } catch {
      toast.error(t('Failed to send verification code'))
    } finally {
      setSendingCode(false)
      if (isTurnstileEnabled) {
        setTurnstileToken('')
        setTurnstileWidgetKey((current) => current + 1)
      }
    }
  }

  const handleBind = async () => {
    if (!email || !code) {
      toast.error(t('Please enter email and verification code'))
      return
    }

    try {
      setLoading(true)
      const response = await bindEmail(email, code)

      if (response.success) {
        toast.success(t('Email bound successfully!'))
        onOpenChange(false)
        onSuccess()
        // Reset form
        setEmail('')
        setCode('')
        resetCountdown()
      } else {
        toast.error(response.message || t('Failed to bind email'))
      }
    } catch {
      toast.error(t('Failed to bind email'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      onOpenChange(open)
      if (!open) {
        // Reset form when closing
        setEmail('')
        setCode('')
        resetCountdown()
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('Bind Email')}
      description={
        currentEmail
          ? t('Current email: {{email}}. Enter a new email to change.', {
              email: currentEmail,
            })
          : t('Bind an email address to your account.')
      }
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={handleBind}
            disabled={loading || !email || !code}
          >
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {loading ? t('Binding...') : t('Bind Email')}
          </Button>
        </>
      }
    >
      <div className='space-y-4 py-4'>
        <div className='space-y-2'>
          <Label htmlFor='email'>{t('Email Address')}</Label>
          <Input
            id='email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('Enter your email')}
            disabled={loading}
          />
        </div>

        {isTurnstileEnabled && (
          <div className='flex justify-center'>
            <Turnstile
              key={turnstileWidgetKey}
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
              onExpire={handleTurnstileExpire}
            />
          </div>
        )}

        <div className='space-y-2'>
          <Label htmlFor='code'>{t('Verification Code')}</Label>
          <div className='flex gap-2'>
            <Input
              id='code'
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('Enter code')}
              disabled={loading}
              maxLength={6}
            />
            <Button
              type='button'
              variant='outline'
              onClick={handleSendCode}
              disabled={sendingCode || isActive || !email || loading}
            >
              {sendButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
