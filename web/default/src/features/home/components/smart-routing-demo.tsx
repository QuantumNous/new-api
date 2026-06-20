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
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// home-motion-interactive-prd.md I1 — Smart Routing demo (P0).
// Auto-playing, hover/focus-pausable visualization of "auto" routing. Marketing
// only: a diagram, never a chat (CLAUDE.md red line). Numbers are illustrative
// and labelled "example" (CLAUDE.md §0 rule 3).

interface Example {
  prompt: string
  /** node tag this prompt routes to */
  target: string
  /** model label shown in the result badge */
  model: string
  /** ~% cheaper vs always using a premium model; null for media (no text-LLM tier to compare) */
  savings: number | null
}

const EXAMPLES: Example[] = [
  { prompt: 'Write a polite follow-up email', target: 'haiku', model: 'Claude Haiku', savings: 90 },
  { prompt: 'Refactor this function', target: 'sonnet', model: 'Claude Sonnet', savings: 60 },
  { prompt: 'Summarize a 40-page report', target: 'gemini', model: 'Gemini 2.5 Pro', savings: 70 },
  { prompt: 'Make a 10-second product video', target: 'kling', model: 'Kling', savings: null },
]

const NODES: { tag: string; label: string }[] = [
  { tag: 'haiku', label: 'Haiku' },
  { tag: 'sonnet', label: 'Sonnet' },
  { tag: 'opus', label: 'Opus' },
  { tag: 'gemini', label: 'Gemini' },
  { tag: 'kling', label: 'Kling' },
]

const CYCLE_MS = 3200

export function SmartRoutingDemo() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduce || paused) return
    const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), CYCLE_MS)
    return () => clearInterval(id)
  }, [reduce, paused])

  const active = EXAMPLES[index]

  return (
    <section className='border-border relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-12 text-center md:mb-16'>
          <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase'>
            {t('Smart routing')}
          </p>
          <h2 className='text-3xl font-bold tracking-normal md:text-5xl'>
            {t("You don't pick the model. We do.")}
          </h2>
          <p className='text-muted-foreground mx-auto mt-5 max-w-xl text-base leading-relaxed'>
            {t(
              'Set the model to “auto”. DeepRouter reads each request and sends it to the cheapest model that can do it well — pennies for the simple stuff, a premium model only when it’s actually needed.'
            )}
          </p>
        </div>

        <div
          className='border-border bg-card/70 mx-auto flex flex-col items-center rounded-2xl border p-6 shadow-[0_12px_34px_rgb(28_28_28/0.06)] sm:p-9'
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          tabIndex={0}
          aria-label={t('Smart routing demo')}
        >
          {/* prompt chip */}
          <div className='flex min-h-[3rem] items-center'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={index}
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className='border-border bg-background rounded-full border px-4 py-2 text-sm font-medium shadow-sm'
              >
                “{t(active.prompt)}”
              </motion.div>
            </AnimatePresence>
          </div>

          <Connector replayKey={index} reduce={!!reduce} />

          {/* router node */}
          <div className='border-accent/30 bg-accent/10 text-accent flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold'>
            <span className='relative flex size-2'>
              {!reduce && (
                <motion.span
                  className='bg-accent absolute inline-flex size-full rounded-full'
                  animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className='bg-accent relative inline-flex size-2 rounded-full' />
            </span>
            deeprouter-auto
          </div>

          <Connector replayKey={index} reduce={!!reduce} />

          {/* model nodes */}
          <div className='flex flex-wrap items-center justify-center gap-2'>
            {NODES.map((node) => {
              const on = node.tag === active.target
              return (
                <motion.div
                  key={node.tag}
                  animate={reduce ? undefined : { scale: on ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    on
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {node.label}
                </motion.div>
              )
            })}
          </div>

          {/* result badge + savings bar (I2) */}
          <div className='mt-7 w-full'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={index}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.35, delay: reduce ? 0 : 0.15 }}
              >
                <p className='text-center text-sm leading-relaxed'>
                  <span className='text-muted-foreground'>{t('Routed to')} </span>
                  <span className='font-semibold'>{active.model}</span>
                </p>
                {active.savings !== null ? (
                  <CostBar savings={active.savings} reduce={!!reduce} replayKey={index} />
                ) : (
                  <p className='text-muted-foreground mt-2 text-center text-xs'>
                    {t('The right model for the job — on tap.')}
                  </p>
                )}
                <p className='text-muted-foreground/70 mt-2 text-center text-[11px]'>
                  {t('Example — the router decides per request.')}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

/** I2 — animated cost bar: accent fill shrinks from premium (100%) to routed cost. */
function CostBar({
  savings,
  reduce,
  replayKey,
}: {
  savings: number
  reduce: boolean
  replayKey: number
}) {
  const { t } = useTranslation()
  const routedPct = Math.max(8, 100 - savings)
  return (
    <div className='mx-auto mt-4 max-w-xs'>
      <div className='bg-muted relative h-2.5 w-full overflow-hidden rounded-full'>
        <motion.div
          key={replayKey}
          className='bg-accent absolute inset-y-0 left-0 rounded-full'
          initial={reduce ? false : { width: '100%' }}
          animate={{ width: `${routedPct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.25 }}
        />
      </div>
      <div className='mt-1.5 flex justify-between text-[11px]'>
        <span className='text-muted-foreground'>{t('vs always-premium')}</span>
        <span className='text-accent font-semibold'>
          {t('save {{pct}}%', { pct: savings })}
        </span>
      </div>
    </div>
  )
}

/** Vertical connector with a dot that travels down once per cycle. */
function Connector({ replayKey, reduce }: { replayKey: number; reduce: boolean }) {
  return (
    <div className='relative my-3 h-9 w-px overflow-visible'>
      <div className='bg-border absolute inset-0 mx-auto w-px' />
      {!reduce && (
        <motion.span
          key={replayKey}
          className='bg-accent absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full'
          initial={{ top: 0, opacity: 0 }}
          animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}
