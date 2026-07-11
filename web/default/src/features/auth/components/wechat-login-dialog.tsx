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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import { Dialog } from '@/components/dialog'
import { Label } from '@/components/ui/label'

import { wechatLoginByCode } from '../api'
import { useAuthRedirect } from '../hooks/use-auth-redirect'
import type { SystemStatus } from '../types'

type WeChatLoginDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: SystemStatus | null
  redirectTo?: string
}

export function WeChatLoginDialog(props: WeChatLoginDialogProps) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { handleLoginSuccess } = useAuthRedirect()

  const qrCodeUrl = useMemo(() => {
    const status = props.status
    return (
      status?.wechat_qrcode ||
      status?.wechat_qr_code ||
      status?.wechat_qrcode_image_url ||
      status?.wechat_qr_code_image_url ||
      status?.wechat_account_qrcode_image_url ||
      status?.WeChatAccountQRCodeImageURL ||
      status?.data?.wechat_qrcode ||
      status?.data?.WeChatAccountQRCodeImageURL ||
      ''
    )
  }, [props.status])

  const handleOpenChange = (open: boolean) => {
    props.onOpenChange(open)
    if (!open) {
      setCode('')
      setIsSubmitting(false)
    }
  }

  async function handleSubmit() {
    if (!code.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }

    setIsSubmitting(true)
    try {
      const res = await wechatLoginByCode(code)
      if (res?.success) {
        await handleLoginSuccess(
          res.data as { id?: number } | null,
          props.redirectTo
        )
        toast.success(t('Signed in via WeChat'))
        handleOpenChange(false)
      } else {
        toast.error(res?.message || t('Login failed'))
      }
    } catch {
      toast.error(t('Login failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('WeChat sign in')}
      description={t(
        'Scan the QR code to follow the official account and reply with “验证码” to receive your verification code.'
      )}
      contentClassName='sm:max-w-sm'
      headerClassName='text-left'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={isSubmitting || !code.trim()}
            className='gap-2'
          >
            {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {t('Confirm')}
          </Button>
        </>
      }
    >
      {qrCodeUrl ? (
        <div className='flex justify-center'>
          <img
            src={qrCodeUrl}
            alt={t('WeChat login QR code')}
            className='h-40 w-40 rounded-md border object-contain'
          />
        </div>
      ) : (
        <p className='text-muted-foreground text-sm'>
          {t('QR code is not configured. Please contact support.')}
        </p>
      )}
      <div className='grid gap-2'>
        <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
        <Input
          id='wechat-code'
          placeholder={t('Enter the verification code')}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete='one-time-code'
        />
      </div>
    </Dialog>
  )
}
