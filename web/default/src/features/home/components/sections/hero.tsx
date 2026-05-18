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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Button } from '@/components/ui/button'

// Brand names to show in the "supported models" strip below the hero CTA.
// Plain text rather than logos — keeps the bundle light and avoids the
// trademark / licensing surface for marketing artwork. Real logos can
// land as a follow-up once we standardize the asset set.
const SUPPORTED_BRANDS = [
  'OpenAI',
  'Anthropic',
  'Google',
  'DeepSeek',
  'Moonshot',
  'Alibaba',
  'xAI',
] as const

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()

  return (
    <section className='relative z-10 flex flex-col items-center overflow-hidden px-6 pt-28 pb-16 md:pt-34 md:pb-24'>
      {/* Animated radial bloom — replaces the static gradient. Two layers
       * (warm cream + faint accent blue) drift slowly on long cycles for a
       * Hero that feels alive without being distracting. Respects
       * prefers-reduced-motion (defined in styles/index.css). */}
      <div aria-hidden className='landing-hero-bloom top-0 h-80' />
      <div aria-hidden className='landing-hero-routing-bg'>
        <span className='landing-hero-route landing-hero-route-a' />
        <span className='landing-hero-route landing-hero-route-b' />
        <span className='landing-hero-route landing-hero-route-c' />
        <span className='landing-hero-node landing-hero-node-a' />
        <span className='landing-hero-node landing-hero-node-b' />
        <span className='landing-hero-node landing-hero-node-c' />
        <span className='landing-hero-node landing-hero-node-d' />
      </div>

      <div className='flex max-w-4xl flex-col items-center text-center'>
        <div
          className='landing-animate-fade-up border-border/80 bg-card/70 mb-7 flex h-14 items-center rounded-full border px-5 py-2 shadow-[0_10px_28px_rgb(28_28_28/0.06)]'
          style={{ animationDelay: '0ms' }}
        >
          <img
            src='/logo-full.png'
            alt={systemName}
            className='h-10 w-[220px] rounded-none object-contain object-left sm:w-[270px]'
          />
        </div>
        <h1
          className='landing-animate-fade-up text-[clamp(2.5rem,6.2vw,4.75rem)] leading-[1.02] font-bold tracking-normal'
          style={{ animationDelay: '60ms' }}
        >
          {t('Pay in CNY.')}
          <br />
          <span className='text-accent'>
            {t('Use GPT, Claude, Gemini, DeepSeek.')}
          </span>
        </h1>
        <p
          className='landing-animate-fade-up text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed opacity-0 md:text-lg'
          style={{ animationDelay: '120ms' }}
        >
          {t(
            'Top up via WeChat or Alipay from ¥5. No overseas credit card. No need to sign up with each AI provider separately.'
          )}
        </p>
        <div
          className='landing-animate-fade-up mt-8 flex items-center gap-3 opacity-0'
          style={{ animationDelay: '180ms' }}
        >
          {props.isAuthenticated ? (
            <Button className='group' render={<Link to='/dashboard' />}>
              {t('Go to Dashboard')}
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          ) : (
            <>
              <Button className='group' render={<Link to='/sign-up' />}>
                {t('Get Started')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button variant='outline' render={<Link to='/pricing' />}>
                {t('View Pricing')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Supported brands strip — replaces the developer-oriented terminal
       * demo that used to live here. Per onboarding-v2-prd §7.1 the first
       * screen must not show API / token / base URL noise. The terminal
       * demo file is kept on disk for when we ship a Developer-mode home. */}
      <div
        className='landing-animate-fade-up mt-12 w-full max-w-3xl opacity-0'
        style={{ animationDelay: '260ms' }}
      >
        <p className='text-muted-foreground text-center text-xs tracking-wide uppercase'>
          {t('All these models, one account')}
        </p>
        <div className='mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3'>
          {SUPPORTED_BRANDS.map((brand) => (
            <span
              key={brand}
              className='text-foreground/80 text-base font-medium tracking-tight md:text-lg'
            >
              {brand}
            </span>
          ))}
        </div>
        <div className='mt-4 text-center'>
          <Link
            to='/pricing'
            className='text-muted-foreground hover:text-foreground text-xs'
          >
            {t('See all supported models →')}
          </Link>
        </div>
      </div>
    </section>
  )
}
