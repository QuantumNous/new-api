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
import { ArrowDown, Ellipsis } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { GlobeHero } from '../globe-hero'
import { GlobeIntro } from '../globe-intro'

interface HeroProps {
  className?: string
  children?: ReactNode
}

const providerGroups = [
  { name: 'DeepSeek', icon: 'DeepSeek.Color', color: '#4d6bfe' },
  { name: 'Qwen', icon: 'Qwen.Color', color: '#615ced' },
  { name: 'Zhipu AI', icon: 'Zhipu.Color', color: '#3859ff' },
  { name: 'Doubao', icon: 'Doubao.Color', color: '#7863ff' },
  { name: 'Moonshot AI', icon: 'Kimi.Color', color: '#027aff' },
  { name: 'Baichuan AI', icon: 'Baichuan.Color', color: '#ff6933' },
  { name: 'MiniMax', icon: 'Minimax.Color', color: '#f23f5d' },
  { name: 'MiMo', icon: 'XiaomiMiMo', color: '#ff6900' },
  { name: 'StepFun', icon: 'Stepfun.Color', color: '#0057ff' },
  { name: 'Baidu', icon: 'Baidu.Color', color: '#2932e1' },
  { name: 'Hunyuan', icon: 'Hunyuan.Color', color: '#0053e0' },
  { name: 'Spark', icon: 'Spark.Color', color: '#0070f0' },
  { name: 'Yi', icon: 'Yi.Color', color: '#003425' },
  { name: 'SenseNova', icon: 'SenseNova.Color', color: '#5b2ad8' },
  { name: 'Vidu', icon: 'Vidu.Color', color: '#22d5ff' },
]

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section
      id='platform'
      className={cn(
        'text-foreground relative isolate scroll-mt-16',
        props.className
      )}
    >
      <h1 className='sr-only'>
        {t('One AI gateway for')} {t('AI models')}
      </h1>
      <div className='sticky top-0 z-0'>
        <GlobeHero />
        <GlobeIntro />
        <div className='absolute inset-x-0 bottom-6 flex justify-center sm:bottom-8'>
          <Button
            variant='ghost'
            className='gap-3 rounded-full px-5 text-sm font-normal tracking-wide text-slate-300 hover:bg-white/10 hover:text-white sm:text-base'
            render={<a href='#models' />}
            onClick={(event) => {
              const target = document.querySelector('#models')
              if (
                !target ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return
              }
              event.preventDefault()
              target.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'instant'
                  : 'smooth',
                block: 'start',
              })
            }}
          >
            {t('Explore the routing architecture')}
            <ArrowDown aria-hidden='true' className='size-4' />
          </Button>
        </div>
      </div>
      <div
        data-home-overlay
        className='bg-background relative z-10 rounded-t-3xl shadow-[0_-16px_60px_-20px_rgba(0,0,0,0.4)]'
      >
        <div
          id='models'
          className='mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6'
        >
          <AnimateInView>
            <div className='border-primary/20 text-card-foreground rounded-2xl border bg-[color-mix(in_oklch,var(--card)_88%,var(--foreground)_6%)] px-4 py-4 shadow-[0_18px_55px_-45px_color-mix(in_oklch,var(--foreground)_45%,transparent)] backdrop-blur'>
              <p className='text-foreground mb-3 text-center text-xs font-bold tracking-[0.18em] uppercase'>
                {t('Route requests across China-first model providers')}
              </p>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8'>
                {providerGroups.map((provider) => (
                  <div
                    key={provider.name}
                    className='text-foreground flex min-w-0 items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--provider-color)_35%,transparent)] bg-[color-mix(in_srgb,var(--provider-color)_10%,var(--background))] px-3 py-3 text-center text-xs font-semibold'
                    style={
                      { '--provider-color': provider.color } as CSSProperties
                    }
                  >
                    <span
                      aria-hidden='true'
                      className='flex shrink-0 items-center text-[var(--provider-color)]'
                    >
                      {getLobeIcon(provider.icon, 22)}
                    </span>
                    <span>{t(provider.name)}</span>
                  </div>
                ))}
                <Button
                  variant='outline'
                  className='h-auto min-h-12 gap-2 rounded-xl border-dashed px-3 py-3 text-xs'
                  render={<Link to='/pricing' />}
                >
                  <Ellipsis aria-hidden='true' className='size-5' />
                  {t('More...')}
                </Button>
              </div>
            </div>
          </AnimateInView>
        </div>
        {props.children}
      </div>
    </section>
  )
}
