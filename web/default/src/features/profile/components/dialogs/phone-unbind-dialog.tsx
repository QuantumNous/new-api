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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCountdown } from '@/hooks/use-countdown'

import { sendSmsVerification, unbindPhone } from '../../api'

// ============================================================================
// Phone Unbind Dialog Component
// ============================================================================

interface PhoneUnbindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPhone?: string
  onSuccess: () => void
}

export function PhoneUnbindDialog({
  open,
  onOpenChange,
  currentPhone,
  onSuccess,
}: PhoneUnbindDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [code, setCode] = useState('')
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
    reset: resetCountdown,
  } = useCountdown({
    initialSeconds: 60,
  })

  const handleSendCode = async () => {
    if (!currentPhone) return

    try {
      setSendingCode(true)
      const response = await sendSmsVerification(currentPhone)

      if (response.success) {
        toast.success(t('Verification code sent to your phone'))
        startCountdown()
      } else {
        toast.error(response.message || t('Failed to send SMS verification code'))
      }
    } catch (_error) {
      toast.error(t('Failed to send SMS verification code'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleUnbind = async () => {
    if (!code) {
      toast.error(t('Please enter the SMS verification code'))
      return
    }

    try {
      setLoading(true)
      const response = await unbindPhone(code)

      if (response.success) {
        toast.success(t('Phone unbound successfully!'))
        onOpenChange(false)
        onSuccess()
        setCode('')
        resetCountdown()
      } else {
        toast.error(response.message || t('Failed to unbind phone'))
      }
    } catch (_error) {
      toast.error(t('Failed to unbind phone'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      onOpenChange(open)
      if (!open) {
        setCode('')
        resetCountdown()
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('Unbind Phone')}
      description={
        currentPhone
          ? t('Unbind {{phone}} from your account?', { phone: currentPhone })
          : t('Unbind the phone number from your account.')
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
            variant='destructive'
            onClick={handleUnbind}
            disabled={loading || !code}
          >
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {loading ? t('Unbinding...') : t('Unbind Phone')}
          </Button>
        </>
      }
    >
      <div className='space-y-4 py-4'>
        <div className='space-y-2'>
          <Label htmlFor='unbind-code'>{t('SMS verification code')}</Label>
          <div className='flex gap-2'>
            <Input
              id='unbind-code'
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('Enter code')}
              disabled={loading}
              maxLength={6}
              inputMode='numeric'
              autoComplete='one-time-code'
            />
            <Button
              type='button'
              variant='outline'
              onClick={handleSendCode}
              disabled={sendingCode || isActive || !currentPhone}
            >
              {isActive
                ? `${secondsLeft}s`
                : sendingCode
                  ? t('Sending...')
                  : t('Send')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
