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
import { useEffect, useRef } from 'react'
import { Gift, Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CopyButton } from '@/components/copy-button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { trackInvitePromoEvent } from '../../api'

interface InvitePromoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  affRatio: number
  affiliateLink: string
}

export function InvitePromoDialog({ open, onOpenChange, affRatio, affiliateLink }: InvitePromoDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({
    successMessage: t('Copied! Share it with your friends'),
  })
  const isCopied = copiedText === affiliateLink
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      void trackInvitePromoEvent('invite_popup_impression')
    }
    wasOpenRef.current = open
  }, [open])

  async function handleCopy() {
    const success = await copyToClipboard(affiliateLink)
    if (success) {
      void trackInvitePromoEvent('invite_popup_copy')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm text-center' showCloseButton>
        <DialogHeader className='items-center gap-3'>
          <div className='flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30'>
            <Gift className='size-7 text-white' />
          </div>
          <DialogTitle className='text-base'>
            {t('Invite friends, earn {{pct}}% commission', { pct: affRatio })}
          </DialogTitle>
          <DialogDescription className='text-sm'>
            {t(
              'When a friend tops up through your link, {{pct}}% of their top-up amount is automatically added to your balance',
              { pct: affRatio }
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-2 text-left'>
          <div className='text-muted-foreground text-xs font-medium uppercase tracking-wider'>
            {t('Your referral link')}
          </div>
          <div className='flex items-center gap-2'>
            <Input
              value={affiliateLink}
              readOnly
              className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
            />
            <CopyButton
              value={affiliateLink}
              variant='outline'
              className='bg-background size-9 shrink-0'
              iconClassName='size-4'
              tooltip={t('Copy referral link')}
              aria-label={t('Copy referral link')}
              onCopied={() => {
                void trackInvitePromoEvent('invite_popup_copy')
              }}
            />
          </div>
        </div>

        <Button
          className='mt-2 w-full border-0 text-white shadow-md shadow-amber-500/30 hover:brightness-105'
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}
          onClick={handleCopy}
        >
          {isCopied ? <Check className='size-4' /> : <Copy className='size-4' />}
          {t('Copy referral link')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
