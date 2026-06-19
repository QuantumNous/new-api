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
      <div className='mx-auto max-w-6xl px-6 py-10 md:py-12'>
        <div className='border-border bg-card/70 grid grid-cols-2 gap-px overflow-hidden rounded-xl border shadow-[0_12px_34px_rgb(28_28_28/0.06)] md:grid-cols-4'>
          {stats.map((s) => (
            <div
              key={s.label}
              className='bg-card/80 flex flex-col items-center px-4 py-7 text-center'
            >
              <span className='text-2xl font-bold tracking-normal tabular-nums md:text-3xl'>
                <Counter
                  end={s.end}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals}
                />
              </span>
              <span className='text-muted-foreground mt-1.5 text-xs'>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
