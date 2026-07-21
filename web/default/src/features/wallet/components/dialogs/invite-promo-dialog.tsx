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
import { useEffect, useRef, useState } from 'react'
import { Gift, Check, Copy, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getSignupGift, trackInvitePromoEvent } from '../../api'

interface InvitePromoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  affRatio: number
  affiliateLink: string
  preview?: boolean
}

export function InvitePromoDialog({
  open,
  onOpenChange,
  affRatio,
  affiliateLink,
  preview = false,
}: InvitePromoDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({
    successMessage: t('Copied! Share it with your friends'),
  })
  const isCopied = copiedText === affiliateLink
  const wasOpenRef = useRef(false)
  const [trialCreditUsd, setTrialCreditUsd] = useState<number | null>(null)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      if (!preview) void trackInvitePromoEvent('invite_popup_impression')
    }
    wasOpenRef.current = open
  }, [open, preview])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    void getSignupGift().then((gift) => {
      if (
        !cancelled &&
        gift?.enabled &&
        gift.benefit_type === 'trial_subscription' &&
        Number(gift.trial_credit_usd) > 0
      ) {
        setTrialCreditUsd(Number(gift.trial_credit_usd))
      }
    })

    return () => {
      cancelled = true
    }
  }, [open])

  async function handleCopy() {
    const success = await copyToClipboard(affiliateLink)
    if (success) {
      void trackInvitePromoEvent('invite_popup_copy')
    }
  }

  function shareMessage() {
    const credit = trialCreditUsd
      ? `$${Number.isInteger(trialCreditUsd) ? trialCreditUsd : trialCreditUsd.toFixed(2)}`
      : ''
    return t('Share APIMaster invite', { credit })
  }

  function openShare(target: 'x' | 'telegram') {
    const message = shareMessage()
    const shareUrl =
      target === 'x'
        ? `https://x.com/intent/post?text=${encodeURIComponent(`${message}\n${affiliateLink}`)}`
        : `https://t.me/share/url?url=${encodeURIComponent(affiliateLink)}&text=${encodeURIComponent(message)}`

    window.open(shareUrl, '_blank', 'noopener,noreferrer')
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
          <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Your referral link')}
          </div>
          <Input
            value={affiliateLink}
            readOnly
            className='border-muted bg-background/70 h-10 min-w-0 font-mono text-xs'
          />
        </div>

        <Button
          type='button'
          variant='outline'
          className='border-border bg-background text-foreground hover:bg-muted w-full'
          onClick={handleCopy}
        >
          {isCopied ? (
            <Check className='size-4' />
          ) : (
            <Copy className='size-4' />
          )}
          {t('Copy referral link')}
        </Button>

        <div className='mt-1 grid grid-cols-2 gap-3'>
          <Button
            type='button'
            className='border-0 bg-zinc-950 text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200'
            onClick={() => openShare('x')}
          >
            <span className='text-base font-semibold'>X</span>
            {t('Share on X')}
          </Button>
          <Button
            type='button'
            className='border-0 bg-[#229ED9] text-white shadow-sm hover:bg-[#1D8FC5]'
            onClick={() => openShare('telegram')}
          >
            <Send className='size-4' />
            {t('Share on Telegram')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
