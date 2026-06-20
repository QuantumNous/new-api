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
import { useRef, useState, type PointerEvent } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CircleDollarSign,
  Cpu,
  Gauge,
  Globe2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Button } from '@/components/ui/button'
import { HeroAccessWizard } from '../hero-access-wizard'

// Brand names to show in the "supported models" strip below the hero CTA.
// Plain text rather than logos — keeps the bundle light and avoids the
// trademark / licensing surface for marketing artwork. Real logos can
// land as a follow-up once we standardize the asset set (I5: hover reveals
// the models behind each brand as the lightweight, asset-free fallback).
const SUPPORTED_BRANDS: { name: string; models: string }[] = [
  { name: 'OpenAI', models: 'GPT-5.5 · GPT-4o · o-series' },
  { name: 'Anthropic', models: 'Claude Opus · Sonnet · Haiku' },
  { name: 'Google', models: 'Gemini 2.5 Pro · Flash' },
  { name: 'DeepSeek', models: 'DeepSeek V3 · R1' },
  { name: 'Moonshot', models: 'Kimi (Moonshot)' },
  { name: 'Alibaba', models: 'Qwen 通义千问' },
  { name: 'xAI', models: 'Grok' },
]

const ROUTING_FLOW = [
  { name: 'OpenAI', status: 'Live', value: '32ms', tone: 'accent' },
  { name: 'Claude', status: 'Best fit', value: '0.8x', tone: 'success' },
  { name: 'Gemini', status: 'Fallback', value: 'Ready', tone: 'warning' },
] as const

const HERO_BENEFITS = [
  {
    icon: Wallet,
    label: 'CNY top-up',
  },
  {
    icon: ShieldCheck,
    label: 'No overseas card',
  },
  {
    icon: Globe2,
    label: '25+ models',
  },
] as const

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const reduce = useReducedMotion()

  // I7 — pointer parallax on the decorative layers. Written straight to the DOM
  // via refs (no state) so mouse-move never re-renders the hero. Off when the
  // user prefers reduced motion.
  const bloomRef = useRef<HTMLDivElement>(null)
  const routingRef = useRef<HTMLDivElement>(null)
  // I3 — the routing background lights up once the visitor uses the wizard.
  const [interacted, setInteracted] = useState(false)

  const handlePointer = (e: PointerEvent<HTMLElement>) => {
    if (reduce) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    if (bloomRef.current)
      bloomRef.current.style.transform = `translate3d(${x * 14}px, ${y * 14}px, 0)`
    if (routingRef.current)
      routingRef.current.style.transform = `translate3d(${x * 26}px, ${y * 26}px, 0)`
  }
  const resetPointer = () => {
    if (bloomRef.current) bloomRef.current.style.transform = ''
    if (routingRef.current) routingRef.current.style.transform = ''
  }

  return (
    <section
      className='relative z-10 overflow-hidden px-6 pt-24 pb-14 md:pt-30 md:pb-18'
      onPointerMove={handlePointer}
      onPointerLeave={resetPointer}
    >
      {/* Animated radial bloom — replaces the static gradient. Two layers
       * (warm cream + faint accent blue) drift slowly on long cycles for a
       * Hero that feels alive without being distracting. Respects
       * prefers-reduced-motion (defined in styles/index.css). */}
      <div
        ref={bloomRef}
        aria-hidden
        className='landing-hero-bloom top-0 h-80'
        style={{ transition: 'transform 0.25s ease-out' }}
      />
      <div
        ref={routingRef}
        aria-hidden
        className='landing-hero-routing-bg'
        data-active={interacted ? 'true' : undefined}
        style={{
          transition: 'transform 0.25s ease-out, opacity 0.6s ease',
          opacity: interacted ? 1 : undefined,
        }}
      >
        <span className='landing-hero-route landing-hero-route-a' />
        <span className='landing-hero-route landing-hero-route-b' />
        <span className='landing-hero-route landing-hero-route-c' />
        <span className='landing-hero-node landing-hero-node-a' />
        <span className='landing-hero-node landing-hero-node-b' />
        <span className='landing-hero-node landing-hero-node-c' />
        <span className='landing-hero-node landing-hero-node-d' />
      </div>

      <div className='mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.92fr)] lg:gap-14'>
        <div className='max-w-3xl'>
          <div
            className='landing-animate-fade-up border-border/80 bg-card/75 mb-7 inline-flex h-13 items-center rounded-full border px-4 py-2 shadow-[0_10px_28px_rgb(28_28_28/0.06)] backdrop-blur'
            style={{ animationDelay: '0ms' }}
          >
            <img
              src='/logo-full.png'
              alt={systemName}
              className='h-9 w-[210px] rounded-none object-contain object-left sm:w-[250px]'
            />
          </div>
          <h1
            className='landing-animate-fade-up max-w-3xl text-[clamp(2.65rem,6.8vw,5.7rem)] leading-[0.96] font-bold tracking-normal'
            style={{ animationDelay: '60ms' }}
          >
            {t('One key for')}
            <br />
            <span className='text-accent'>{t('every major AI model.')}</span>
          </h1>
          <p
            className='landing-animate-fade-up text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed opacity-0 md:text-lg'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'Top up once, call GPT, Claude, Gemini, DeepSeek and more through one reliable account. DeepRouter handles access, routing, balance, and invoices.'
            )}
          </p>
          <div
            className='landing-animate-fade-up mt-8 flex flex-col gap-3 opacity-0 sm:flex-row sm:items-center'
            style={{ animationDelay: '180ms' }}
          >
            {props.isAuthenticated ? (
              <Button
                className='group h-11 px-5'
                render={<Link to='/dashboard' />}
              >
                {t('Go to Dashboard')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            ) : (
              <>
                <Button
                  className='group h-11 px-5'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get Started')}
                  <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  className='h-11 px-5'
                  variant='outline'
                  render={<Link to='/pricing' />}
                >
                  {t('View Pricing')}
                </Button>
              </>
            )}
          </div>

          <div
            className='landing-animate-fade-up mt-7 grid max-w-2xl gap-2 opacity-0 sm:grid-cols-3'
            style={{ animationDelay: '220ms' }}
          >
            {HERO_BENEFITS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className='border-border/80 bg-card/60 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-[0_8px_22px_rgb(28_28_28/0.04)] backdrop-blur'
                >
                  <Icon className='text-accent size-4 shrink-0' />
                  <span className='text-foreground/80 font-medium'>
                    {t(item.label)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className='landing-animate-fade-left relative opacity-0'
          style={{ animationDelay: '160ms' }}
        >
          <div className='absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle_at_20%_20%,rgb(37_99_255/0.16),transparent_34%),radial-gradient(circle_at_80%_10%,rgb(20_143_95/0.13),transparent_30%),linear-gradient(135deg,rgb(28_28_28/0.08),transparent)] blur-2xl' />
          <div className='border-foreground/10 bg-foreground text-primary-foreground relative overflow-hidden rounded-2xl border shadow-[0_28px_70px_rgb(28_28_28/0.24)]'>
            <div className='border-primary-foreground/10 flex items-center justify-between border-b px-4 py-3'>
              <div className='flex items-center gap-2'>
                <span className='bg-success size-2.5 rounded-full' />
                <span className='text-primary-foreground/70 text-xs font-medium'>
                  {t('Live routing console')}
                </span>
              </div>
              <div className='text-primary-foreground/45 text-xs tabular-nums'>
                {t('99.98% uptime')}
              </div>
            </div>

            <div className='grid gap-5 p-5 sm:p-6'>
              <div className='grid gap-3 sm:grid-cols-3'>
                {[
                  {
                    icon: Cpu,
                    label: 'Models',
                    value: '25+',
                    sub: 'available',
                  },
                  {
                    icon: Gauge,
                    label: 'Latency',
                    value: '32ms',
                    sub: 'best route',
                  },
                  {
                    icon: CircleDollarSign,
                    label: 'Cost',
                    value: '-18%',
                    sub: 'optimized',
                  },
                ].map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div
                      key={metric.label}
                      className='border-primary-foreground/10 bg-primary-foreground/[0.045] rounded-xl border p-3'
                    >
                      <div className='text-primary-foreground/55 flex items-center gap-2 text-xs'>
                        <Icon className='size-3.5' />
                        {t(metric.label)}
                      </div>
                      <div className='mt-3 text-2xl font-semibold tracking-normal'>
                        {metric.value}
                      </div>
                      <div className='text-primary-foreground/45 mt-0.5 text-xs'>
                        {t(metric.sub)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className='border-primary-foreground/10 bg-primary-foreground/[0.035] rounded-xl border p-4'>
                <div className='mb-4 flex items-center justify-between'>
                  <div>
                    <div className='text-sm font-semibold'>
                      {t('Smart route selected')}
                    </div>
                    <div className='text-primary-foreground/45 mt-1 text-xs'>
                      {t('Route by health, price, and availability')}
                    </div>
                  </div>
                  <Sparkles className='text-accent size-5' />
                </div>
                <div className='space-y-2.5'>
                  {ROUTING_FLOW.map((route) => (
                    <div
                      key={route.name}
                      className='bg-primary-foreground/[0.055] flex items-center justify-between rounded-lg px-3 py-2.5'
                    >
                      <div className='flex items-center gap-2.5'>
                        <span
                          className={`size-2 rounded-full ${
                            route.tone === 'success'
                              ? 'bg-success'
                              : route.tone === 'warning'
                                ? 'bg-warning'
                                : 'bg-accent'
                          }`}
                        />
                        <span className='text-sm font-medium'>
                          {route.name}
                        </span>
                      </div>
                      <div className='flex items-center gap-3 text-xs'>
                        <span className='text-primary-foreground/48'>
                          {t(route.status)}
                        </span>
                        <span className='text-primary-foreground font-semibold tabular-nums'>
                          {route.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <HeroAccessWizard
                className='bg-primary-foreground text-foreground shadow-none'
                onInteract={() => setInteracted(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className='landing-animate-fade-up mx-auto mt-10 w-full max-w-5xl opacity-0'
        style={{ animationDelay: '280ms' }}
      >
        <div className='border-border/80 bg-card/60 flex flex-col items-center gap-4 rounded-xl border px-5 py-4 shadow-[0_12px_34px_rgb(28_28_28/0.06)] backdrop-blur md:flex-row md:justify-between'>
          <p className='text-muted-foreground text-center text-xs tracking-wide uppercase md:text-left'>
            {t('All these models, one account')}
          </p>
          <div className='flex flex-wrap items-center justify-center gap-x-6 gap-y-2'>
            {SUPPORTED_BRANDS.map((brand) => (
              <span
                key={brand.name}
                title={brand.models}
                className='text-foreground/70 hover:text-foreground cursor-default text-sm font-semibold tracking-tight transition-colors'
              >
                {brand.name}
              </span>
            ))}
          </div>
          <Link
            to='/pricing'
            className='text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium'
          >
            {t('See all supported models')}
          </Link>
        </div>
      </div>
    </section>
  )
}
