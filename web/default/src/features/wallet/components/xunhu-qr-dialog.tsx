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
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface XunhuQrDialogProps {
  open: boolean
  qrCodeUrl: string | null
  onOpenChange: (open: boolean) => void
}

export function XunhuQrDialog(props: XunhuQrDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
    >
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('Scan to Pay')}</DialogTitle>
          <DialogDescription>
            {t(
              'Please scan the QR code with WeChat or Alipay. Balance will update automatically after payment.'
            )}
          </DialogDescription>
        </DialogHeader>
        {props.qrCodeUrl ? (
          <div className='flex justify-center py-2'>
            <img
              src={props.qrCodeUrl}
              alt={t('Payment QR Code')}
              className='h-56 w-56 rounded-md border object-contain'
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
