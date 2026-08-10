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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import { bindWeChat } from '../../api'

interface WeChatBindDialogProps {
  open: boolean
  qrCodeUrl: string
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function WeChatBindDialog(props: WeChatBindDialogProps) {
  const { t } = useTranslation()
  const [verificationCode, setVerificationCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (open: boolean) => {
    if (submitting) return
    if (!open) setVerificationCode('')
    props.onOpenChange(open)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = verificationCode.trim()
    if (!code || submitting) return

    setSubmitting(true)
    try {
      const response = await bindWeChat(code)
      if (!response.success) {
        toast.error(t('Request failed'))
        return
      }

      toast.success(t('Binding successful!'))
      setVerificationCode('')
      props.onOpenChange(false)
      props.onSuccess()
    } catch {
      toast.error(t('Request failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('Bind WeChat Account')}
      description={t(
        'Scan the QR code to follow the official account and reply with “验证码” to receive your verification code.'
      )}
      contentClassName='max-w-sm'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='wechat-bind-form'
            disabled={submitting || !verificationCode.trim()}
          >
            {submitting && <Spinner data-icon='inline-start' />}
            {t('Bind')}
          </Button>
        </>
      }
    >
      <form id='wechat-bind-form' onSubmit={handleSubmit}>
        <FieldGroup>
          {props.qrCodeUrl ? (
            <div className='flex justify-center'>
              <img
                src={props.qrCodeUrl}
                alt={t('WeChat login QR code')}
                className='size-48 rounded-lg border object-contain'
              />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('QR code is not configured. Please contact support.')}
            </p>
          )}

          <Field data-disabled={submitting}>
            <FieldLabel htmlFor='wechat-bind-code'>
              {t('Verification code')}
            </FieldLabel>
            <Input
              id='wechat-bind-code'
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              placeholder={t('Enter the verification code')}
              autoComplete='one-time-code'
              disabled={submitting}
              autoFocus
            />
          </Field>
        </FieldGroup>
      </form>
    </Dialog>
  )
}
