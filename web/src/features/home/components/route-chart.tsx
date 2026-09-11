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
import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useLandingModels } from '../hooks/use-landing-models'
import type { RouteGroup } from '../lib/default-landing-models'

const GROUP_TITLES: Record<string, string> = {
  priority: 'Priority routes',
  free: 'Free models',
  value: 'Value & aggregated',
}

/**
 * Route coverage chart in the lieflat "dot cascade" idiom: one dot = one
 * model, fanned on a dotted hairline rail. Each route group's model list is
 * counted and drawn as a column of unit dots, so the number reads at a glance
 * without a legend or axis. Animation is a per-dot pop, gated by
 * IntersectionObserver and disabled under reduced motion.
 */
export function RouteChart() {
  const { t } = useTranslation()
  const config = useLandingModels()
  const svgRef = useRef<SVGSVGElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const root = rootRef.current
    if (!svg || !root) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const dots = svg.querySelectorAll('.rt-dot')
    const played = new Set<Element>()

    const play = () => {
      if (played.size === 0) {
        dots.forEach((dot, i) => {
          if (reduced.matches) {
            dot.classList.add('is-on')
            return
          }
          const el = dot as HTMLElement
          el.style.transitionDelay = `${i * 12}ms`
          el.classList.add('is-on')
        })
        played.add(svg)
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) play()
        })
      },
      { threshold: 0.3 }
    )
    io.observe(root)
    return () => io.disconnect()
  }, [config.serviceRoutes])

  const groups: RouteGroup[] = config.serviceRoutes
  const W = 340
  const H = 240
  const colW = W / (groups.length + 1)

  return (
    <div
      ref={rootRef}
      className='bg-card text-card-foreground border-border/60 rounded-2xl border p-6 md:p-8'
    >
      <style>{`
        .rt-dot{opacity:0;transform-box:fill-box;transform-origin:center;transform:scale(0)}
        .rt-dot.is-on{opacity:1;transform:none;transition:opacity .25s ease,transform .5s cubic-bezier(.2,.7,.3,1.3)}
        @media (prefers-reduced-motion:reduce){.rt-dot{opacity:1;transform:none;transition:none}}
      `}</style>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className='w-full'
        role='img'
        aria-label={t('Route coverage by group')}
      >
        {groups.map((g, gi) => {
          const cx = colW * (gi + 1)
          const count = g.models.length
          const dotR = 3.4
          const spacing = 15
          const colH = count * spacing
          const top = (H - 56 - colH) / 2 + 20
          return (
            <g key={g.id}>
              {/* hairline rail */}
              <line
                x1={cx}
                y1={top - 10}
                x2={cx}
                y2={top + colH + 10}
                stroke='currentColor'
                className='text-border'
                strokeWidth={1}
                strokeDasharray='2 4'
                opacity={0.7}
              />
              {Array.from({ length: count }, (_, k) => {
                const y = top + k * spacing
                const dotId = `dot-${gi}-${k}`
                return (
                  <circle
                    key={dotId}
                    id={dotId}
                    cx={cx}
                    cy={y}
                    r={dotR}
                    className='rt-dot fill-current'
                    data-i={k}
                  >
                    <title>
                      {g.group} · {g.models[k]}
                    </title>
                  </circle>
                )
              })}
              {/* count label on top */}
              <text
                x={cx}
                y={top - 18}
                textAnchor='middle'
                fontSize={10}
                fontWeight={800}
                className='fill-foreground'
              >
                {count}
              </text>
              {/* group label rotated below */}
              <text
                x={cx}
                y={top + colH + 26}
                textAnchor='end'
                fontSize={6.5}
                fontWeight={600}
                className='fill-muted-foreground'
                transform={`rotate(-90 ${cx} ${top + colH + 26})`}
              >
                {t(GROUP_TITLES[g.kind] ?? g.group)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className='text-muted-foreground mt-4 flex items-center gap-3 font-mono text-[10px] tracking-[0.16em] uppercase'>
        <span className='bg-foreground inline-block size-2 rounded-full' />
        {t('one dot = one model')}
        <span className='text-border'>·</span>
        <span>{t('route coverage')}</span>
      </div>
    </div>
  )
}
