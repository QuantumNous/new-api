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
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface WechatQrPayDialogProps {
  open: boolean
  codeUrl: string
  onOpenChange: (open: boolean) => void
  onRefresh: () => void | Promise<void>
}

export function WechatQrPayDialog(props: WechatQrPayDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('WeChat Pay')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('Use WeChat to scan the QR code and complete payment.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className='flex justify-center py-4'>
          <div className='rounded-xl border bg-white p-4'>
            {props.codeUrl ? (
              <QRCodeSVG value={props.codeUrl} size={220} />
            ) : null}
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => void props.onRefresh()}>
            {t('I have completed payment, refresh wallet')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
