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
import { QrCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ============================================================================
// WeChat Bind Dialog Component
// ============================================================================

interface WeChatBindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function WeChatBindDialog({
  open,
  onOpenChange,
}: WeChatBindDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Bind WeChat Account')}
      description={t('Scan the QR code with WeChat to bind your account')}
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      <div className='space-y-4 py-4'>
        <Alert>
          <QrCode className='h-4 w-4' />
          <AlertDescription>
            {t(
              'Please use WeChat\'s "Scan QR Code" feature to complete the binding process.'
            )}
          </AlertDescription>
        </Alert>

        <EmptyState
          icon={QrCode}
          className='min-h-0 p-8'
          title={t('WeChat QR code will be displayed here')}
          description={t(
            'This feature requires server-side WeChat configuration'
          )}
        />

        <p className='text-muted-foreground text-center text-xs'>
          {t('After scanning, the binding will complete automatically')}
        </p>
      </div>
    </Dialog>
  )
}
