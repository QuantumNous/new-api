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
import { Sparkles, TrendingDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

// Each tier maps an everyday request → the model class that handles it → the
// saving. Strings reuse keys already translated in the i18n bundle.
const TIERS = [
  {
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/50',
    glow: 'shadow-emerald-500/20',
    level: 'Easy',
    ask: '“What day is it today?”',
    model: '→ a fast, cheap model',
    note: 'about 95% cheaper',
    barCost: 12, // relative cost for the chart
  },
  {
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/50',
    glow: 'shadow-amber-500/20',
    level: 'Medium',
    ask: '“Write a polite follow-up email”',
    model: '→ a balanced mid-tier model',
    note: 'best value',
    barCost: 45,
  },
  {
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/50',
    glow: 'shadow-rose-500/20',
    level: 'Hard',
    ask: '“Analyse this code and fix the bug”',
    model: '→ a top-tier model, only when needed',
    note: 'full power',
    barCost: 100,
  },
] as const

function RoutingFlow() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setActive((p) => (p + 1) % TIERS.length), 2800)
    return () => clearInterval(id)
  }, [reduce])

  const cur = TIERS[active]

  return (
    <div className='border-border bg-card rounded-2xl border p-6 shadow-[0_8px_24px_rgb(28_28_28/0.06)] md:p-8'>
      {/* incoming request chip (cycles) */}
      <div className='flex h-10 items-center justify-center'>
        <AnimatePresence mode='wait'>
          <motion.span
            key={active}
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.3 }}
            className='border-border bg-background rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm'
          >
            {t(cur.ask)}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* connector with a travelling dot */}
      <div className='relative mx-auto my-2 h-8 w-px bg-gradient-to-b from-border to-transparent'>
        {!reduce && (
          <motion.span
            key={active}
            className={`absolute left-1/2 size-2 -translate-x-1/2 rounded-full ${cur.dot}`}
            initial={{ top: 0, opacity: 0 }}
            animate={{ top: '100%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.7 }}
          />
        )}
      </div>

      {/* the router node */}
      <div className='mb-4 flex justify-center'>
        <div className='border-accent bg-accent/10 relative flex items-center gap-2 rounded-xl border px-4 py-2'>
          {!reduce && (
            <motion.span
              className='border-accent/40 absolute inset-0 rounded-xl border'
              animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.12, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <Sparkles className='text-accent-foreground size-4' strokeWidth={1.75} />
          <span className='font-mono text-sm font-semibold'>auto</span>
          <span className='text-muted-foreground text-xs'>{t('Smart Routing')}</span>
        </div>
      </div>

      {/* model tiers — active one lights up */}
      <div className='flex flex-col gap-2.5'>
        {TIERS.map((tier, i) => {
          const on = i === active
          return (
            <motion.div
              key={tier.level}
              animate={{ opacity: on ? 1 : 0.4 }}
              transition={{ duration: 0.4 }}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all ${
                on
                  ? `border-transparent ring-2 ${tier.ring} bg-background shadow-lg ${tier.glow}`
                  : 'border-border'
              }`}
            >
              <span className={`size-2.5 shrink-0 rounded-full ${tier.dot}`} />
              <span className='text-muted-foreground w-10 shrink-0 text-xs font-semibold'>
                {t(tier.level)}
              </span>
              <span className='text-muted-foreground min-w-0 flex-1 truncate text-sm'>
                {t(tier.model)}
              </span>
              {on && (
                <motion.span
                  initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className='text-foreground shrink-0 text-xs font-bold'
                >
                  {t(tier.note)}
                </motion.span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* mini cost-comparison chart */}
      <div className='border-border mt-6 border-t pt-5'>
        <div className='mb-2 flex items-center justify-between text-xs'>
          <span className='text-muted-foreground'>
            {t('If every request used a premium model')}
          </span>
          <span className='text-muted-foreground font-mono'>100%</span>
        </div>
        <div className='bg-muted h-2.5 w-full overflow-hidden rounded-full'>
          <div className='bg-muted-foreground/40 h-full w-full rounded-full' />
        </div>
        <div className='mt-3 mb-2 flex items-center justify-between text-xs'>
          <span className='text-foreground font-semibold'>
            {t('With smart routing')}
          </span>
          <span className='text-emerald-600 font-mono font-semibold'>~22%</span>
        </div>
        <div className='bg-muted h-2.5 w-full overflow-hidden rounded-full'>
          <motion.div
            className='h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400'
            initial={reduce ? false : { width: 0 }}
            whileInView={{ width: '22%' }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

export function SmartRouting() {
  const { t } = useTranslation()

  return (
    <section className='border-border relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16'>
        <AnimateInView animation='fade-up'>
          <p className='text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase'>
            <Sparkles className='size-4' strokeWidth={1.5} />
            {t('Smart Routing')}
          </p>
          <h2 className='mb-5 text-3xl font-bold tracking-normal md:text-5xl'>
            {t("Don't know which model to pick? We do.")}
          </h2>
          <p className='text-muted-foreground mb-6 text-base leading-relaxed md:text-lg'>
            {t(
              'Just set the model to “auto”. DeepRouter reads each request and sends it to the cheapest model that can do the job well — so simple questions cost pennies and only the hard ones use a premium model. You save money without thinking about it.'
            )}
          </p>
          <div className='text-accent-foreground bg-accent inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold'>
            <TrendingDown className='size-4' strokeWidth={2} />
            {t('Up to 90% cheaper on everyday tasks')}
          </div>
        </AnimateInView>

        <AnimateInView animation='fade-up' delay={150}>
          <RoutingFlow />
        </AnimateInView>
      </div>
    </section>
  )
}
