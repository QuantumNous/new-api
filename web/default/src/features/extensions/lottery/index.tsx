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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Turnstile } from '@/components/turnstile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { drawLottery, getLotteryStatus } from './api'
import { LuckyPrizeBoard } from './components/lucky-prize-board'
import { PrizeResultDialog } from './components/prize-result-dialog'
import { useMarqueeSpin } from './hooks/use-marquee-spin'
import {
  buildWeightedPrizeSlots,
  pickCellForPrize,
} from './lib/grid-layout'
import { buildBetSymbols, buildFreeSymbols } from './lib/symbols'
import type { LotteryDrawResult } from './types'

export function LotteryPage() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const queryClient = useQueryClient()
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''

  const [useBet, setUseBet] = useState(false)
  const [betUsd, setBetUsd] = useState(0.01)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<LotteryDrawResult | null>(null)
  const [resultOpen, setResultOpen] = useState(false)

  const query = useQuery({
    queryKey: ['lottery-status'],
    queryFn: getLotteryStatus,
  })

  const data = query.data
  const isCrazyThursday = !!data?.is_crazy_thursday
  const meetsRedemptionRequirement = !!data?.meets_redemption_requirement
  const canDraw = !!data?.can_draw
  const symbols = useMemo(() => {
    if (!data) return []
    return useBet
      ? buildBetSymbols(data.bet_prizes || [])
      : buildFreeSymbols(data.free_prizes || [])
  }, [data, useBet])

  const board = useMemo(
    () => buildWeightedPrizeSlots(symbols.map((s) => s.weight)),
    [symbols]
  )

  const marquee = useMarqueeSpin({
    cellCount: board.slots.length || 1,
  })

  const settledCellIndex = useMemo(() => {
    if (!result) return null
    const match = board.slots.find((s) => s.prizeIndex === result.prize_index)
    return match?.cellIndex ?? null
  }, [board.slots, result])

  useEffect(() => {
    if (!data) return
    const maxBet = Math.min(data.max_bet_usd, data.user_usd)
    const minBet = Math.min(data.min_bet_usd, maxBet)
    setBetUsd((prev) => {
      if (prev < minBet) return minBet
      if (prev > maxBet) return Math.max(minBet, maxBet)
      return prev
    })
  }, [data])

  useEffect(() => {
    if (!data?.today_draw) return
    setResult({
      prize_index: data.today_draw.prize_index,
      prize_name: data.today_draw.prize_name,
      quota_delta: data.today_draw.quota_delta,
      usd_delta: data.today_draw.usd_delta,
      bet_quota: data.today_draw.bet_quota,
      bet_usd: data.today_draw.bet_usd,
      is_thanks: data.today_draw.is_thanks,
      is_pity: data.today_draw.is_pity,
      is_thursday: data.today_draw.is_thursday,
      remaining_pool: 0,
      remaining_pool_usd: 0,
      draw_date: data.today_draw.draw_date,
    })
  }, [data])

  const maxBetAllowed = data ? Math.min(data.max_bet_usd, data.user_usd) : 0

  let spinLabel = t('SPIN')
  if (drawing) {
    spinLabel = t('SPINNING')
  } else if (data && !meetsRedemptionRequirement) {
    spinLabel = t('Redeem code required')
  } else if (!canDraw) {
    spinLabel = t('Already spun today')
  }

  async function runDraw() {
    if (!data || !canDraw || drawing) return
    if (!meetsRedemptionRequirement) {
      toast.error(
        t(
          'Please redeem a code before playing. Crazy Thursday does not require this.'
        )
      )
      return
    }
    if (turnstileEnabled && !turnstileToken) {
      toast.error(t('Please complete the human verification first'))
      return
    }
    if (useBet) {
      if (betUsd < data.min_bet_usd || betUsd > data.max_bet_usd) {
        toast.error(t('Bet amount is out of range'))
        return
      }
      if (betUsd > data.user_usd) {
        toast.error(t('Bet cannot exceed your current balance'))
        return
      }
    }

    setDrawing(true)
    setResult(null)
    setResultOpen(false)
    // Start the orange marquee immediately so users see motion while waiting API
    marquee.start()

    try {
      const drawResult = await drawLottery(
        useBet ? betUsd : 0,
        turnstileToken || undefined
      )
      const landCell = pickCellForPrize(board.slots, drawResult.prize_index)
      await marquee.stopAt(landCell)
      setResult(drawResult)
      setResultOpen(true)
      setTurnstileToken('')
      setTurnstileKey((k) => k + 1)
      await queryClient.invalidateQueries({ queryKey: ['lottery-status'] })
    } catch (error) {
      marquee.reset()
      toast.error(
        error instanceof Error ? error.message : t('Lottery draw failed')
      )
      setTurnstileToken('')
      setTurnstileKey((k) => k + 1)
    } finally {
      setDrawing(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Lucky Slot')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        {query.isPending ? (
          <div className='flex items-center justify-center gap-2 py-16'>
            <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
            <span className='text-muted-foreground text-sm'>
              {t('Loading...')}
            </span>
          </div>
        ) : null}

        {query.isError ? (
          <Alert variant='destructive'>
            <AlertTitle>{t('Unable to load lottery')}</AlertTitle>
            <AlertDescription>
              {query.error instanceof Error
                ? query.error.message
                : t('Failed to load lottery status')}
            </AlertDescription>
          </Alert>
        ) : null}

        {data ? (
          <div className='space-y-6'>
            {isCrazyThursday ? (
              <Alert
                className={cn(
                  'relative overflow-hidden border-0 px-4 py-4 text-white shadow-[0_10px_30px_rgba(220,38,38,0.45)] sm:px-5 sm:py-5',
                  'bg-[linear-gradient(135deg,#F87171_0%,#EF4444_35%,#DC2626_70%,#991B1B_100%)]',
                  'ring-2 ring-red-300 ring-offset-2 ring-offset-background'
                )}
              >
                <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.28),transparent_45%)]' />
                <div className='pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-yellow-300/25 blur-2xl' />
                <div className='relative flex flex-col items-center justify-center gap-2 text-center'>
                  <AlertTitle className='flex items-center justify-center gap-2 text-xl font-black tracking-wide text-white drop-shadow sm:gap-3 sm:text-2xl'>
                    <span
                      className='inline-block animate-bounce text-2xl sm:text-3xl'
                      style={{ animationDelay: '0ms' }}
                      aria-hidden
                    >
                      🔥
                    </span>
                    <span className='inline-block animate-bounce [animation-duration:900ms]'>
                      {t('Crazy Thursday!')}
                    </span>
                    <span
                      className='inline-block animate-bounce text-2xl sm:text-3xl'
                      style={{ animationDelay: '150ms' }}
                      aria-hidden
                    >
                      🔥
                    </span>
                  </AlertTitle>
                  <AlertDescription className='animate-bounce text-base font-semibold leading-relaxed text-red-50 [animation-delay:80ms] [animation-duration:1.05s] sm:text-lg'>
                    {t(
                      'Prize pool and free prize amounts are doubled today. V me 50!'
                    )}
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}

            {data.require_redemption && !meetsRedemptionRequirement ? (
              <Alert variant='destructive'>
                <AlertTitle>{t('Redeem code required')}</AlertTitle>
                <AlertDescription>
                  {t(
                    'Please redeem a code before playing. Crazy Thursday does not require this.'
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className='grid gap-3 sm:grid-cols-3'>
              <StatCard
                label={t('Daily prize pool')}
                value={`$${data.effective_display_daily_pool_usd.toFixed(2)}`}
              />
              <StatCard
                label={t('Your balance')}
                value={`$${data.user_usd.toFixed(4)}`}
              />
              <StatCard
                label={t('Pity progress')}
                value={`${data.thanks_streak}/${data.pity_threshold}`}
              />
            </div>

            <LuckyPrizeBoard
              symbols={symbols}
              rows={board.rows}
              cols={board.cols}
              slots={board.slots}
              crazyThursday={isCrazyThursday}
              canDraw={canDraw}
              drawing={drawing}
              activeIndex={
                marquee.activeIndex ??
                (!canDraw ? settledCellIndex : null)
              }
              blinkOn={marquee.blinkOn}
              phase={
                result && !canDraw && marquee.phase === 'idle'
                  ? 'done'
                  : marquee.phase
              }
              onRequestStart={() => void runDraw()}
            />

            <div className='mx-auto max-w-3xl space-y-4 rounded-2xl border bg-card p-4 sm:p-5'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <Label>{t('Bet with USD')}</Label>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Optional. Max net win is 2x bet; you may also lose balance.'
                    )}
                  </p>
                </div>
                <Switch
                  checked={useBet}
                  onCheckedChange={setUseBet}
                  disabled={!canDraw || drawing}
                />
              </div>

              {useBet ? (
                <div className='space-y-2'>
                  <Label htmlFor='bet-usd'>{t('Bet amount (USD)')}</Label>
                  <Input
                    id='bet-usd'
                    type='number'
                    step='0.01'
                    min={data.min_bet_usd}
                    max={maxBetAllowed}
                    value={betUsd}
                    disabled={!canDraw || drawing}
                    onChange={(e) => setBetUsd(Number(e.target.value) || 0)}
                  />
                  <p className='text-muted-foreground text-xs'>
                    {t('Allowed: ${{min}} – ${{max}}', {
                      min: data.min_bet_usd,
                      max: maxBetAllowed,
                    })}
                  </p>
                </div>
              ) : null}

              {turnstileEnabled ? (
                <div className='flex justify-center'>
                  <Turnstile
                    key={turnstileKey}
                    siteKey={turnstileSiteKey}
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                  />
                </div>
              ) : null}

              <Button
                className={cn(
                  'h-12 w-full text-base font-bold tracking-wider',
                  isCrazyThursday &&
                    'bg-amber-500 text-black hover:bg-amber-400'
                )}
                disabled={!canDraw || drawing || symbols.length === 0}
                onClick={() => void runDraw()}
              >
                {drawing ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : null}
                {spinLabel}
              </Button>
            </div>

            <PrizeResultDialog
              open={resultOpen}
              result={result}
              onOpenChange={setResultOpen}
            />
          </div>
        ) : null}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className='rounded-xl border bg-card px-4 py-3'>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='mt-1 text-lg font-semibold tabular-nums'>
        {props.value}
      </div>
    </div>
  )
}
