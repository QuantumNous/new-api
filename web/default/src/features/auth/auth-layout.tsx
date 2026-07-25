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
import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  OFFICIAL_WEBSITE_ORIGIN,
  consoleWebsitePath,
  officialWebsiteUrl,
} from '@/lib/origins'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FlatkeyBrandLogo,
  FLATKEY_MARK,
} from '@/components/brand/flatkey-brand-logo'
import { LanguageSwitcher } from '@/components/language-switcher'

type AuthLayoutProps = {
  children: React.ReactNode
}

// Shared Public Sans wordmark stack (matches FlatkeyBrandLogo) so the caption
// headline on the pixel panel stays on-brand without depending on theme classes.
const WORDMARK_FONT_FAMILY =
  "'Public Sans', Inter, 'SF Pro Display', Arial, sans-serif"

// ---------------------------------------------------------------------------
// Model-name pixel animation
// ---------------------------------------------------------------------------
// React port of the old static login's `pixeltype.js`: pixel squares fly in,
// assemble into a model name, hold, then scatter and cycle to the next word.
// The words are brand literals (product/model names) — never translated.
// 5x7 pixel font map (row-major, "1" = lit pixel).
const PIXEL_FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100', '00100', '00100'],
}
const PIXEL_WORDS = [
  'FLATKEY',
  'GPT',
  'CLAUDE',
  'GEMINI',
  'DEEPSEEK',
  'SEEDANCE',
  'GLM',
  'QWEN',
]
const PIXEL_COLORS = ['#A78BFA', '#C4B5FD', '#8B5CF6', '#DDD6FE']
const PIXEL_ACCENT = '#67E8F9'

function ModelNamePixels() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const pool: HTMLElement[] = []
    const timers: ReturnType<typeof setTimeout>[] = []
    let cancelled = false
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Target pixel positions for a word, centered inside the host box.
    const layout = (word: string): Array<[number, number, number]> => {
      const cols = word.length * 6 - 1
      const W = host.clientWidth
      const H = host.clientHeight
      const cell = Math.min(
        Math.floor((W * 0.86) / cols),
        Math.floor((H * 0.6) / 7),
        22
      )
      const ox = Math.round((W - cols * cell) / 2)
      const oy = Math.round((H - 7 * cell) / 2)
      const pts: Array<[number, number, number]> = []
      for (let li = 0; li < word.length; li++) {
        const g = PIXEL_FONT[word[li]]
        if (!g) continue
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 5; c++) {
            if (g[r][c] === '1') {
              pts.push([ox + (li * 6 + c) * cell, oy + r * cell, cell])
            }
          }
        }
      }
      return pts
    }

    const show = (word: string) => {
      const pts = layout(word)
      while (pool.length < pts.length) {
        const d = document.createElement('i')
        d.style.cssText =
          'position:absolute;display:block;opacity:0;transition:transform .8s cubic-bezier(.22,.9,.3,1),opacity .6s ease;will-change:transform'
        host.appendChild(d)
        pool.push(d)
      }
      pool.forEach((d, i) => {
        if (i < pts.length) {
          const p = pts[i]
          d.style.width = d.style.height = p[2] - 2 + 'px'
          d.style.background =
            Math.random() < 0.05
              ? PIXEL_ACCENT
              : PIXEL_COLORS[Math.floor(Math.random() * PIXEL_COLORS.length)]
          d.style.transitionDelay = Math.random() * 0.35 + 's'
          // Scatter start position (only when the square is currently hidden).
          if (d.style.opacity === '0') {
            d.style.transitionDuration = '0s'
            d.style.transform =
              'translate(' +
              (p[0] + (Math.random() - 0.5) * 420) +
              'px,' +
              (p[1] + (Math.random() - 0.5) * 420) +
              'px) rotate(' +
              (Math.random() - 0.5) * 180 +
              'deg)'
            void d.offsetWidth
            d.style.transitionDuration = ''
          }
          d.style.transform =
            'translate(' + p[0] + 'px,' + p[1] + 'px) rotate(0deg)'
          d.style.opacity = '1'
        } else {
          d.style.transform += ' scale(.2)'
          d.style.opacity = '0'
        }
      })
    }

    const hide = () => {
      pool.forEach((d) => {
        if (d.style.opacity === '1') {
          d.style.transitionDelay = Math.random() * 0.2 + 's'
          d.style.transform = d.style.transform.replace(
            /\) rotate.*/,
            ') rotate(' + (Math.random() - 0.5) * 160 + 'deg) scale(.3)'
          )
          d.style.opacity = '0'
        }
      })
    }

    let idx = 0
    const cycle = () => {
      if (cancelled) return
      show(PIXEL_WORDS[idx % PIXEL_WORDS.length])
      idx++
      timers.push(
        setTimeout(() => {
          if (cancelled) return
          hide()
          timers.push(setTimeout(cycle, 700))
        }, 2600)
      )
    }

    if (reduce) {
      // Respect reduced-motion: assemble the first word once and hold it.
      show(PIXEL_WORDS[0])
    } else {
      cycle()
    }

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      pool.forEach((d) => d.remove())
      pool.length = 0
    }
  }, [])

  return (
    <div
      ref={hostRef}
      aria-hidden
      className='absolute inset-x-0 top-[6%] z-[1] h-[56%]'
    />
  )
}

// Deterministic blinking pixel cluster (`.pxgrid`), ported from `pixels.js`.
function PixelGrid() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const cell = 24
    const cols = 7
    const rows = 5
    const n = 14
    const colors = ['#A78BFA55', '#C4B5FD44', '#8B5CF655']
    const accent = '#67E8F955'
    let seed = 179
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    el.style.width = cols * cell + 'px'
    el.style.height = rows * cell + 'px'

    const used: Record<string, number> = {}
    const nodes: HTMLElement[] = []
    for (let i = 0; i < n; i++) {
      let x: number
      let y: number
      let k: string
      let tries = 0
      do {
        x = Math.floor(rnd() * cols)
        y = Math.floor(rnd() * rows)
        k = x + '_' + y
      } while (used[k] && ++tries < 40)
      used[k] = 1
      const s = document.createElement('i')
      s.style.position = 'absolute'
      s.style.left = x * cell + 'px'
      s.style.top = y * cell + 'px'
      s.style.width = s.style.height = cell + 'px'
      s.style.background =
        rnd() < 0.07 ? accent : colors[Math.floor(rnd() * colors.length)]
      // `pxblink` keyframes live in the global stylesheet (src/styles/index.css).
      // Skip the animation entirely under prefers-reduced-motion.
      if (!reduce) {
        s.style.animation = 'pxblink 8s steps(1,end) infinite'
        s.style.animationDelay = (rnd() * 7).toFixed(2) + 's'
        s.style.animationDuration = (5 + rnd() * 7).toFixed(2) + 's'
      }
      el.appendChild(s)
      nodes.push(s)
    }

    return () => {
      nodes.forEach((nd) => nd.remove())
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className='pointer-events-none absolute z-0 overflow-hidden'
      style={{ right: -20, bottom: 110, opacity: 0.8 }}
    />
  )
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t, i18n } = useTranslation()
  const { systemName, loading } = useSystemConfig()

  return (
    <div className='auth-landing text-foreground relative grid min-h-svh max-w-none overflow-hidden bg-[linear-gradient(180deg,#fbfbff_0%,#f6f3ff_44%,#ffffff_100%)] lg:grid-cols-2 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_44%,#03040b_100%)] dark:text-white'>
      {/* ------------------------------------------------------------------ */}
      {/* LEFT: auth form column (form + OAuth buttons, behavior unchanged)   */}
      {/* ------------------------------------------------------------------ */}
      <div className='relative flex min-h-svh flex-col overflow-hidden'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(109,40,217,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(109,40,217,0.07)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-50 dark:bg-[linear-gradient(to_right,rgba(167,139,250,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(167,139,250,0.07)_1px,transparent_1px)] dark:opacity-45'
        />
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_42%_at_50%_14%,rgba(124,58,237,0.12),transparent_72%),radial-gradient(ellipse_42%_34%_at_78%_32%,rgba(217,70,239,0.08),transparent_70%),radial-gradient(ellipse_36%_28%_at_18%_72%,rgba(99,102,241,0.1),transparent_76%)] dark:bg-[radial-gradient(ellipse_62%_42%_at_50%_14%,rgba(124,58,237,0.28),transparent_72%),radial-gradient(ellipse_42%_34%_at_78%_32%,rgba(217,70,239,0.16),transparent_70%),radial-gradient(ellipse_36%_28%_at_18%_72%,rgba(99,102,241,0.18),transparent_76%)]'
        />
        {(() => {
          // z-20 keeps the logo above the form column (relative z-10) so the
          // link stays clickable — the form panel previously swallowed the click.
          const logoClassName =
            'absolute top-4 left-4 z-20 flex items-center rounded-full transition-opacity hover:opacity-90 sm:top-8 sm:left-8'
          const logoInner = (
            <>
              <div className='relative h-11'>
                {loading ? (
                  <Skeleton className='absolute inset-y-1 left-0 w-32 rounded-full' />
                ) : (
                  <FlatkeyBrandLogo alt={t('Logo')} className='h-11' />
                )}
              </div>
              {loading ? (
                <Skeleton className='h-6 w-24' />
              ) : (
                <h1 className='sr-only text-xl font-semibold tracking-normal'>
                  {systemName}
                </h1>
              )}
            </>
          )
          // When a separate marketing site is configured, the logo links out to its home
          // (OpenRouter-style). Otherwise fall back to the in-app root.
          return OFFICIAL_WEBSITE_ORIGIN ? (
            <a
              href={officialWebsiteUrl(consoleWebsitePath(i18n.language, '/'))}
              className={logoClassName}
            >
              {logoInner}
            </a>
          ) : (
            <Link to='/' className={logoClassName}>
              {logoInner}
            </Link>
          )
        })()}
        <div className='absolute top-4 right-4 z-10 sm:top-8 sm:right-8'>
          <LanguageSwitcher />
        </div>
        <div className='relative z-10 flex flex-1 items-center justify-center px-4 pt-20 pb-10 sm:px-8 sm:pt-24 sm:pb-12'>
          <div className='flex w-full max-w-[420px] flex-col justify-center space-y-2 rounded-3xl border border-violet-200/60 bg-white/82 px-5 py-8 shadow-[0_28px_100px_-54px_rgba(91,33,182,0.42)] backdrop-blur-xl sm:p-10 dark:border-violet-300/12 dark:bg-white/[0.035] dark:shadow-[0_28px_100px_-48px_rgba(124,58,237,0.62)]'>
            {children}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT: animated model-name pixel panel (decorative, collapses < lg) */}
      {/* ------------------------------------------------------------------ */}
      <div
        className='relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center'
        style={{
          background:
            'radial-gradient(130% 170% at 60% -10%,#5B21B6 0%,#3B0FA0 42%,#22084F 100%)',
        }}
      >
        {/* soft radial glow blooms */}
        <div
          aria-hidden
          className='pointer-events-none absolute h-[520px] w-[520px] rounded-full'
          style={{
            background: 'radial-gradient(circle,#8B5CF64d,transparent 65%)',
            left: -140,
            top: -120,
          }}
        />
        <div
          aria-hidden
          className='pointer-events-none absolute h-[520px] w-[520px] rounded-full'
          style={{
            background: 'radial-gradient(circle,#67E8F933,transparent 65%)',
            right: -160,
            bottom: -140,
          }}
        />

        {/* the star: model names assembling from flying pixels */}
        <ModelNamePixels />

        {/* deterministic blinking pixel cluster */}
        <PixelGrid />

        {/* small brand shield, top-left of the panel */}
        <img
          src={FLATKEY_MARK}
          alt=''
          aria-hidden
          className='absolute top-8 left-9 z-[2] h-9 w-9 opacity-90 drop-shadow-[0_10px_30px_rgba(49,10,90,0.45)]'
        />

        {/* caption: chip + headline + subline */}
        <div className='absolute bottom-9 left-9 z-[2] max-w-[420px] text-white'>
          <span className='inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3.5 py-[7px] font-mono text-[11.5px] backdrop-blur-md'>
            {t('160+ official models · seedance-2.5 video included')}
          </span>
          <h3
            className='mt-3.5 max-w-[420px] text-3xl leading-[1.1] font-semibold tracking-[-1px] [text-shadow:0_2px_18px_rgba(0,0,0,0.4)]'
            style={{ fontFamily: WORDMARK_FONT_FAMILY }}
          >
            {t('More AI. Less cost. Every frontier model, one key.')}
          </h3>
          <p className='mt-2 max-w-[380px] text-[13px] text-[#D8D8E2]'>
            {t(
              'Text, video and audio through the same official endpoints — with a signed SLA behind every call.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
