/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { Copy, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function InviteLinkCard({ affCode }: { affCode: string }) {
  const { t } = useTranslation()
  const [qrOpen, setQrOpen] = useState(false)
  // Renders a link only when there's an aff code so we don't paste
  // "/register?aff=" (no value) into the clipboard.
  const link = useMemo(
    () => (affCode ? `${window.location.origin}/register?aff=${affCode}` : ''),
    [affCode]
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('My Referral Link')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='bg-muted truncate rounded-md p-2 font-mono text-xs'>
          {link || '—'}
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={!link}
            onClick={() => {
              void navigator.clipboard.writeText(link)
              toast.success(t('Copied'))
            }}
          >
            <Copy className='mr-1 h-4 w-4' />
            {t('Copy')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={!link}
            onClick={() => setQrOpen(true)}
          >
            <QrCode className='mr-1 h-4 w-4' />
            {t('QR Code')}
          </Button>
        </div>
      </CardContent>
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className='w-fit'>
          <DialogHeader>
            <DialogTitle>{t('Scan to register')}</DialogTitle>
          </DialogHeader>
          {link && <QRCodeSVG value={link} size={220} includeMargin />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
