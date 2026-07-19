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

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import type { LotteryDrawResult } from '../types'

type PrizeResultDialogProps = {
  open: boolean
  result: LotteryDrawResult | null
  onOpenChange: (open: boolean) => void
}

export function PrizeResultDialog(props: PrizeResultDialogProps) {
  const { t } = useTranslation()
  const result = props.result
  if (!result) return null

  const positive = result.usd_delta > 0
  const negative = result.usd_delta < 0
  const amountText =
    result.usd_delta > 0
      ? `+$${result.usd_delta.toFixed(4)}`
      : `$${result.usd_delta.toFixed(4)}`

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-center text-xl'>
            {positive ? t('Congratulations!') : t('Result')}
          </DialogTitle>
          <DialogDescription className='text-center'>
            {t('You got {{name}} ({{delta}})', {
              name: result.prize_name,
              delta: amountText,
            })}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'mx-auto my-2 flex min-h-28 w-full max-w-xs flex-col items-center justify-center rounded-2xl border px-4 py-6 text-center',
            positive &&
              'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            negative &&
              'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
            !positive &&
              !negative &&
              'border-zinc-500/30 bg-muted text-muted-foreground'
          )}
        >
          <div className='text-lg font-bold'>{result.prize_name}</div>
          <div className='mt-2 text-3xl font-black tabular-nums tracking-tight'>
            {amountText}
          </div>
          {result.is_pity ? (
            <div className='mt-2 text-xs'>{t('Pity prize triggered')}</div>
          ) : null}
        </div>

        <DialogFooter>
          <Button className='w-full' onClick={() => props.onOpenChange(false)}>
            {t('Got it')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
