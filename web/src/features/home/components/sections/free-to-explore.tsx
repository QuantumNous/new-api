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

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

const CATEGORIES = [
  {
    key: 'chat',
    label: 'Chat models',
    value: 'Kimi-K2.6 · MiniMax-M2.7 · Qwen 3 8B',
  },
  {
    key: 'image',
    label: 'Image generation',
    value: 'fal.ai: Nano Banana 2 · GPT-Image-2 · Nano Banana Pro',
  },
  {
    key: 'embedding',
    label: 'Embedding + reranking',
    value: 'bge-m3 · bge-reranker · retrieval models',
  },
  {
    key: 'tts',
    label: 'Text to speech',
    value: 'UnrealSpeech V8',
  },
]

export function FreeToExplore() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-24 sm:px-10 md:py-32 lg:px-14'>
      <div className='mx-auto max-w-7xl'>
        <div className='grid gap-12 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-20'>
          <AnimateInView className='lg:sticky lg:top-24 lg:self-start'>
            <p className='text-primary mb-5 font-mono text-[11px] tracking-[0.28em] uppercase'>
              04 / {t('Free to explore')}
            </p>
            <h2 className='text-foreground font-serif text-4xl leading-[1.05] font-medium tracking-[-0.02em] md:text-5xl'>
              {t('Free models,')}
              <br />
              {t('open to explore.')}
            </h2>
          </AnimateInView>

          <div className='border-border/60 divide-border/60 divide-y overflow-hidden rounded-2xl border'>
            {CATEGORIES.map((cat, i) => (
              <AnimateInView
                key={cat.key}
                delay={i * 60}
                animation='fade-up'
                className='hover:bg-card/50 grid gap-2 px-7 py-6 transition-colors duration-200 md:grid-cols-[12rem_1fr] md:items-center md:gap-8'
              >
                <span className='text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase'>
                  {t(cat.label)}
                </span>
                <span className='text-foreground/90 text-sm leading-6 md:text-base'>
                  {t(cat.value)}
                </span>
              </AnimateInView>
            ))}
          </div>
        </div>

        <div className='mt-10 flex flex-wrap items-center gap-4'>
          <Button
            variant='outline'
            className='border-border/60 h-11 rounded-full px-6 text-sm'
            render={<Link to='/pricing' />}
          >
            {t('View all free models')}
            <ArrowRight className='ml-1.5 size-4' />
          </Button>
          <span className='text-muted-foreground text-sm'>
            {t('Some models are available periodically')}
          </span>
        </div>
      </div>
    </section>
  )
}
