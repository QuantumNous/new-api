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
import { useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface CounterProps {
  end: number
  suffix?: string
  prefix?: string
  duration?: number
  decimals?: number
}

function Counter(props: CounterProps) {
  // Longer default duration (2.4s vs 1.6s) so viewers actually see the
  // numbers rolling. Small-end values (10, 50) finished too fast at 1.6s
  // to register as animation rather than a single repaint.
  const { end, suffix = '', prefix = '', duration = 2400, decimals = 0 } = props
  const ref = useRef<HTMLSpanElement>(null)
  const startedRef = useRef(false)

  const formatValue = useCallback(
    (v: number) =>
      decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString(),
    [decimals]
  )

  const animate = useCallback(() => {
    const el = ref.current
    if (!el) return
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      el.textContent = `${prefix}${formatValue(eased * end)}${suffix}`
      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        // Brief "settled" flash when the count locks in — a single class
        // toggle hooks into the .landing-stat-settle keyframes in
        // styles/index.css. Cleared on animation end so re-mounts replay.
        el.classList.add('landing-stat-settle')
        const onEnd = () => {
          el.classList.remove('landing-stat-settle')
          el.removeEventListener('animationend', onEnd)
        }
        el.addEventListener('animationend', onEnd)
      }
    }
    requestAnimationFrame(step)
  }, [end, duration, prefix, suffix, formatValue])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      el.textContent = `${prefix}${formatValue(end)}${suffix}`
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true
          animate()
          observer.unobserve(el)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [animate, end, prefix, suffix, formatValue])

  return (
    <span ref={ref} className='tabular-nums'>
      {prefix}0{suffix}
    </span>
  )
}

interface StatsProps {
  className?: string
}

interface StatItem {
  end: number
  suffix?: string
  prefix?: string
  label: string
  decimals?: number
}

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()

  // Stats rewritten for onboarding-v2 §7.1 — user-facing benefit numbers
  // instead of dev-stack jargon. Counter component supports prefix as
  // well as suffix, so "$5" renders correctly. Minimum top-up is $5 USD
  // (pricing is USD-denominated; CNY is just one accepted payment method).
  const stats: StatItem[] = [
    { end: 25, suffix: '+', label: t('AI models in one account') },
    { end: 5, prefix: '$', label: t('minimum top-up') },
    { end: 100, suffix: '%', label: t('pay as you go') },
    { end: 0, label: t('overseas credit cards needed') },
  ]

  return (
    <div className='relative z-10 px-6'>
      <div className='mx-auto max-w-7xl py-8 md:py-10'>
        <div className='border-border/80 bg-card/70 overflow-hidden rounded-2xl border shadow-[0_16px_45px_rgb(28_28_28/0.07)] backdrop-blur'>
          <div className='border-border/70 flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7'>
            <div>
              <p className='text-muted-foreground text-xs font-semibold tracking-widest uppercase'>
                {t('Launch ready')}
              </p>
              <h2 className='mt-1 text-lg font-semibold tracking-normal'>
                {t('Everything needed to start using AI APIs today')}
              </h2>
            </div>
            <div className='text-muted-foreground flex flex-wrap gap-2 text-xs'>
              <span className='border-border bg-background/70 rounded-full border px-3 py-1'>
                {t('Access')}
              </span>
              <span className='border-border bg-background/70 rounded-full border px-3 py-1'>
                {t('Billing')}
              </span>
              <span className='border-border bg-background/70 rounded-full border px-3 py-1'>
                {t('Routing')}
              </span>
            </div>
          </div>
          <div className='bg-border/70 grid grid-cols-2 gap-px md:grid-cols-4'>
            {stats.map((s) => (
              <div
                key={s.label}
                className='bg-card/90 flex min-h-34 flex-col justify-center px-5 py-7'
              >
                <span className='text-3xl font-bold tracking-normal tabular-nums md:text-4xl'>
                  <Counter
                    end={s.end}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    decimals={s.decimals}
                  />
                </span>
                <span className='text-muted-foreground mt-2 max-w-[11rem] text-sm leading-snug'>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
