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

export function Exclusive3D() {
  const { t } = useTranslation()

  const specs = [
    { label: t('Input'), value: 'TEXT / IMAGE' },
    { label: t('Output'), value: 'GLB' },
    { label: t('Average time'), value: '~ 200 SEC' },
    { label: t('Workflow'), value: 'BLENDER READY' },
  ]

  return (
    <section className='relative z-10 px-6 py-24 sm:px-10 md:py-32 lg:px-14'>
      <div className='mx-auto max-w-4xl text-center'>
        <AnimateInView className='mx-auto mb-16 max-w-3xl md:mb-20'>
          <p className='text-primary mb-5 font-mono text-[11px] tracking-[0.28em] uppercase'>
            03 / {t('Exclusive 3D API')}
          </p>
          <h2 className='text-foreground font-serif text-4xl leading-[1.05] font-medium tracking-[-0.02em] md:text-5xl'>
            {t('From a prompt,')}
            <br />
            {t('to a delivery-ready 3D asset.')}
          </h2>
          <p className='text-muted-foreground mt-6 max-w-xl text-base leading-7'>
            {t(
              'Text-to-3D, image-to-3D, texture generation, and a Blender add-on: one API for rapid prototyping, asset production, and workflow integration.'
            )}
          </p>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button
              className='group h-11 rounded-full px-6 text-sm'
              render={<Link to='/pricing' />}
            >
              {t('View 3D API pricing')}
              <ArrowRight className='ml-1.5 size-4 transition-transform group-hover:translate-x-0.5' />
            </Button>
            <span className='text-muted-foreground flex items-center gap-2 text-sm'>
              <span className='bg-primary/10 text-primary rounded-full px-3 py-1 font-mono text-xs'>
                GLB
              </span>
              {t('Blender-ready output')}
            </span>
          </div>
        </AnimateInView>

        <div className='landing-card-motion border-border/60 bg-card/40 rounded-2xl border p-8 text-center md:p-12'>
          <div className='grid grid-cols-2 gap-6 md:grid-cols-4'>
            {specs.map((spec, i) => (
              <AnimateInView
                key={spec.label}
                delay={i * 60}
                animation='fade-up'
                className='flex flex-col items-center'
              >
                <span className='text-muted-foreground mb-2 font-mono text-[10px] tracking-[0.2em] uppercase'>
                  {spec.label}
                </span>
                <span className='text-foreground font-serif text-xl font-medium tracking-tight'>
                  {spec.value}
                </span>
              </AnimateInView>
            ))}
          </div>
          <div className='border-border/50 mt-10 border-t pt-6'>
            <div className='text-muted-foreground font-mono text-xs tracking-[0.15em]'>
              BUILDING / ASSET_01.GLB
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
