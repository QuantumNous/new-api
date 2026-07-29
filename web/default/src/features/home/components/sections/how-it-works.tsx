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
import {
  ArrowRight,
  KeyRound,
  Layers3,
  PlugZap,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { HeroTerminalDemo } from '../hero-terminal-demo'

export function HowItWorks() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'

  const steps = [
    {
      num: '01',
      title: t('Top Up Account'),
      desc: t(
        'Go to Wallet and choose an available payment method and amount.'
      ),
      href: '/wallet',
      cta: t('Go to Wallet'),
      icon: <WalletCards className='size-5' strokeWidth={1.5} />,
    },
    {
      num: '02',
      title: t('Create API Key'),
      desc: t(
        'Create keys in API Tokens, split by project, rotate anytime to reduce leak risk.'
      ),
      href: '/keys',
      cta: t('Create Token'),
      icon: <KeyRound className='size-5' strokeWidth={1.5} />,
    },
    {
      num: '03',
      title: t('Choose Models'),
      desc: t(
        'Browse capabilities, pricing, and context length in Model Hub, then copy the model name to call.'
      ),
      href: '/pricing',
      cta: t('Browse Models'),
      icon: <Layers3 className='size-5' strokeWidth={1.5} />,
    },
    {
      num: '04',
      title: t('Integrate Apps'),
      desc: t(
        'Compatible SDKs typically require only the platform Base URL and API key.'
      ),
      href: docsUrl,
      external: docsUrl.startsWith('http'),
      cta: t('View Integration Guide'),
      icon: <PlugZap className='size-5' strokeWidth={1.5} />,
    },
  ]

  return (
    <section
      aria-label={t('Quick start and platform capabilities')}
      className='border-border/40 relative z-10 border-t px-6 py-24 md:py-32'
    >
      <div className='mx-auto max-w-6xl'>
        <div className='mb-12 flex flex-col gap-4 md:mb-16 md:flex-row md:items-end md:justify-between'>
          <AnimateInView className='max-w-2xl'>
            <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
              {t('Quick Start')}
            </p>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              {t('One unified API for the models currently available')}
            </h2>
          </AnimateInView>
          <AnimateInView delay={80}>
            <Button className='rounded-full' render={<Link to='/dashboard' />}>
              {t('Start Now')}
              <ArrowRight className='ml-1.5 size-4' />
            </Button>
          </AnimateInView>
        </div>

        <div className='grid items-start gap-10 lg:grid-cols-12'>
          <AnimateInView delay={100} className='lg:col-span-6'>
            <div className='mb-3 flex items-center justify-between'>
              <p className='text-sm font-semibold'>
                {t('Unified API Example')}
              </p>
              <span className='text-muted-foreground rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300'>
                {t('Multiple API Formats')}
              </span>
            </div>
            <HeroTerminalDemo />
          </AnimateInView>

          <div className='space-y-3 lg:col-span-6'>
            <p className='text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase'>
              {t('Integration Workflow')}
            </p>
            {steps.map((step, i) => {
              const cardClass =
                'group border-border/50 bg-background/70 hover:border-border hover:bg-muted/20 block rounded-2xl border p-4 shadow-xs transition-ui'
              const body = (
                <>
                  <div className='mb-3 flex items-start justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                      <div className='border-border/50 bg-muted/40 text-muted-foreground flex size-10 items-center justify-center rounded-xl border'>
                        {step.icon}
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='text-muted-foreground font-mono text-[11px]'>
                            {step.num}
                          </span>
                          <h3 className='text-sm font-semibold'>
                            {step.title}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className='text-muted-foreground/50 group-hover:text-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5' />
                  </div>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {step.desc}
                  </p>
                  <p className='text-foreground mt-3 text-xs font-medium'>
                    {step.cta}
                  </p>
                </>
              )

              return (
                <AnimateInView key={step.num} delay={120 + i * 70}>
                  {step.external ? (
                    <a
                      href={step.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className={cardClass}
                    >
                      {body}
                    </a>
                  ) : (
                    <Link to={step.href} className={cardClass}>
                      {body}
                    </Link>
                  )}
                </AnimateInView>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
