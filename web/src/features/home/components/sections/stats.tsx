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
  const { end, suffix = '', prefix = '', duration = 1600, decimals = 0 } = props
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
      if (progress < 1) requestAnimationFrame(step)
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
  suffix: string
  label: string
  decimals?: number
  hue: string
}

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()

  const stats: StatItem[] = [
    {
      end: 100,
      suffix: '+',
      label: t('AI models to choose from'),
      hue: 'var(--chart-1)',
    },
    {
      end: 30,
      suffix: '+',
      label: t('popular tools supported'),
      hue: 'var(--chart-2)',
    },
    {
      end: 3,
      suffix: ` ${t('min')}`,
      label: t('from sign-up to first chat'),
      hue: 'var(--chart-3)',
    },
    {
      end: 1,
      suffix: '',
      label: t('key is all you need'),
      hue: 'var(--chart-4)',
    },
  ]

  return (
    <section className='relative z-10 px-6 py-10 md:py-14'>
      <div className='dopa-section-shell' data-section='PROOF'>
        <div className='mb-5 flex items-end justify-between gap-4'>
          <div>
            <p className='dopa-section-kicker'>{t('Why people love it')}</p>
            <h2 className='mt-3 text-2xl font-black tracking-tight md:text-3xl'>
              {t('AI without the headaches')}
            </h2>
          </div>
          <span className='text-muted-foreground hidden font-mono text-[10px] tracking-[0.18em] uppercase md:block'>
            Yecai / live
          </span>
        </div>
        <div className='dopa-data-rail dopa-number-strip grid grid-cols-2 md:grid-cols-4'>
          {stats.map((s) => (
            <div
              key={s.label}
              className='flex min-h-28 flex-col justify-between border-r border-[var(--dopa-rule)] px-4 py-5 last:border-r-0 even:border-r-0 md:min-h-32 md:px-6 md:py-6 md:even:border-r'
            >
              <span
                className='font-mono text-3xl font-black tracking-[-0.07em] md:text-4xl'
                style={{ color: s.hue }}
              >
                <Counter end={s.end} suffix={s.suffix} decimals={s.decimals} />
              </span>
              <span className='text-muted-foreground mt-4 max-w-32 text-xs leading-relaxed font-semibold'>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
