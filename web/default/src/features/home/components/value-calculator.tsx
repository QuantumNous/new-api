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
import { useState } from 'react'
import { Image, MessageSquare, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { Slider } from '@/components/ui/slider'
import {
  estimateChats,
  estimateImages,
  estimateVideoClips,
  estimateCharsByModel,
  formatCount,
} from '@/lib/usage-estimate'

// home-motion-interactive-prd.md I4 — interactive value calculator.
// Slider over a USD top-up → live, order-of-magnitude usage estimates, reusing
// the same `usage-estimate` helpers the wallet uses (CLAUDE.md §0 rule 3:
// shown values are the real marketing estimates, labelled as estimates).
// USD-first; CNY is the China-lane payment method (OPTIMIZATION-PRD positioning).

const QUOTA_PER_USD = 500_000
const MIN_USD = 5
const MAX_USD = 100
const STEP_USD = 5

export function ValueCalculator() {
  const { t } = useTranslation()
  const [usd, setUsd] = useState(20)
  const quota = usd * QUOTA_PER_USD

  const tiles = [
    {
      icon: <MessageSquare className='size-5' strokeWidth={1.5} />,
      value: formatCount(estimateChats(quota)),
      label: t('chats'),
    },
    {
      icon: <Image className='size-5' strokeWidth={1.5} />,
      value: formatCount(estimateImages(quota)),
      label: t('images'),
    },
    {
      icon: <Video className='size-5' strokeWidth={1.5} />,
      value: formatCount(estimateVideoClips(quota)),
      label: t('short videos'),
    },
  ]
  const perModel = estimateCharsByModel(quota)

  return (
    <section className='border-border relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-3xl'>
        <AnimateInView className='mb-12 text-center md:mb-16'>
          <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase'>
            {t('What it buys')}
          </p>
          <h2 className='text-3xl font-bold tracking-normal md:text-5xl'>
            {t('See what your top-up gets you')}
          </h2>
        </AnimateInView>

        <AnimateInView
          animation='fade-up'
          className='border-border bg-card/70 rounded-2xl border p-6 shadow-[0_12px_34px_rgb(28_28_28/0.06)] sm:p-9'
        >
          <div className='mb-6 flex items-end justify-between'>
            <span className='text-muted-foreground text-sm'>{t('Top up')}</span>
            <span className='text-3xl font-bold tabular-nums md:text-4xl'>
              ${usd}
            </span>
          </div>
          <Slider
            value={[usd]}
            min={MIN_USD}
            max={MAX_USD}
            step={STEP_USD}
            onValueChange={(v) =>
              setUsd(Array.isArray(v) ? (v[0] ?? MIN_USD) : v)
            }
            aria-label={t('Top-up amount')}
          />
          <p className='text-muted-foreground/70 mt-2 text-xs'>
            {t('Pay in your currency — incl. CNY via WeChat / Alipay.')}
          </p>

          <div className='mt-7 grid grid-cols-3 gap-3'>
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className='border-border bg-background flex flex-col items-center rounded-xl border px-3 py-5 text-center'
              >
                <span className='text-muted-foreground mb-2'>{tile.icon}</span>
                <span className='text-xl font-bold tabular-nums md:text-2xl'>
                  {tile.value}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {tile.label}
                </span>
              </div>
            ))}
          </div>

          {perModel.length > 0 && (
            <div className='border-border mt-6 border-t pt-5'>
              <p className='text-muted-foreground mb-3 text-xs font-medium'>
                {t('…or roughly this much text:')}
              </p>
              <div className='space-y-2'>
                {perModel.map((m) => (
                  <div
                    key={m.name}
                    className='flex items-center justify-between text-sm'
                  >
                    <span className='text-muted-foreground'>{m.name}</span>
                    <span className='font-semibold tabular-nums'>
                      {formatCount(m.chars)} {t('chars')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className='text-muted-foreground/70 mt-5 text-center text-[11px]'>
            {t('Estimate — actual usage depends on the model and length.')}
          </p>
        </AnimateInView>
      </div>
    </section>
  )
}
