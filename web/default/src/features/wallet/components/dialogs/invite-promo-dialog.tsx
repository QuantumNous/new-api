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
import { Gift, ExternalLink } from 'lucide-react'
import { Link } from '@tanstack/react-router'
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

interface InvitePromoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  affRatio: number
  affiliateLink: string
}

export function InvitePromoDialog({ open, onOpenChange, affRatio, affiliateLink }: InvitePromoDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm text-center' showCloseButton>
        <DialogHeader className='items-center gap-3'>
          <div className='flex size-12 items-center justify-center rounded-full bg-amber-500/10'>
            <Gift className='size-6 text-amber-500' />
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
            />
          </div>
        </div>

        <Link
          to='/affiliate'
          onClick={() => onOpenChange(false)}
          className='text-muted-foreground mt-1 flex items-center justify-center gap-1 text-xs hover:text-foreground'
        >
          {t('View referral details')} <ExternalLink className='size-3' />
        </Link>

        <Button className='mt-2 w-full' variant='outline' onClick={() => onOpenChange(false)}>
          {t('Got it')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
