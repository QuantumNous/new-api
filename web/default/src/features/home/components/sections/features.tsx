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
import { BadgeDollarSign, Server, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { cn } from '@/lib/utils'
import { getLobeIcon } from '@/lib/lobe-icon'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'one-click',
      title: t('One-click access'),
      desc: t(
        'Get one API key and call every connected AI model without applying for each provider separately.'
      ),
      icon: <Server className='size-7' strokeWidth={1.7} />,
      iconClass:
        'bg-violet-600 text-white shadow-[0_14px_32px_-16px_rgba(124,58,237,0.85)]',
    },
    {
      id: 'reliable',
      title: t('Stable and reliable'),
      desc: t(
        'Intelligently route multiple upstream accounts with automatic switching and load balancing to avoid frequent errors.'
      ),
      icon: <UsersRound className='size-7' strokeWidth={1.7} />,
      iconClass:
        'bg-indigo-500 text-white shadow-[0_14px_32px_-16px_rgba(99,102,241,0.78)]',
    },
    {
      id: 'pay-as-you-go',
      title: t('Pay as you go'),
      desc: t(
        'Bill by actual usage, set quota limits, and keep team consumption clear at a glance.'
      ),
      icon: <BadgeDollarSign className='size-7' strokeWidth={1.7} />,
      iconClass:
        'bg-violet-500 text-white shadow-[0_14px_30px_-16px_rgba(139,92,246,0.75)]',
    },
  ]

  const recommendedModels = [
    {
      name: 'GPT Image 2',
      price: '$4 / 1M',
      tags: ['text-to-image'],
      visual: 'from-violet-200 via-fuchsia-300 to-slate-950',
      glow: 'bg-violet-300/45',
    },
    {
      name: 'Seedance 2.0',
      price: '$0.063 / sec',
      tags: ['text-to-video', 'image-to-video'],
      visual: 'from-indigo-200 via-violet-500 to-slate-950',
      glow: 'bg-indigo-300/40',
    },
    {
      name: 'Claude Opus 4.7',
      price: '$4 / 1M',
      tags: ['text-to-text'],
      visual: 'from-fuchsia-200 via-indigo-500 to-slate-950',
      glow: 'bg-fuchsia-300/40',
    },
    {
      name: 'Claude Sonnet 4.6',
      price: '$2.4 / 1M',
      tags: ['text-to-text', 'image-to-text'],
      visual: 'from-slate-100 via-violet-300 to-slate-950',
      glow: 'bg-violet-200/45',
    },
  ]

  const modelTicker = [
    { name: 'DeepSeek V4 Pro', vendor: 'DeepSeek', icon: 'DeepSeek.Color' },
    { name: 'DeepSeek V4 Flash', vendor: 'DeepSeek', icon: 'DeepSeek.Color' },
    { name: 'MiniMax-M2.7', vendor: 'MiniMax', icon: 'Minimax.Color' },
    { name: 'GPT-5.4 nano', vendor: 'OpenAI', icon: 'OpenAI' },
    { name: 'GPT-5.4 mini', vendor: 'OpenAI', icon: 'OpenAI' },
    { name: 'GPT-5.4 pro', vendor: 'OpenAI', icon: 'OpenAI' },
  ]

  const renderTickerItems = (copy: number) => (
    <div className='flex shrink-0 gap-3 px-1' aria-hidden={copy > 0}>
      {modelTicker.map((model) => (
        <div
          key={`${copy}-${model.name}`}
          className='flex shrink-0 items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/5 px-4 py-2 dark:border-violet-300/20 dark:bg-violet-300/5'
        >
          <span className='flex size-5 shrink-0 items-center justify-center'>
            {getLobeIcon(model.icon, 20)}
          </span>
          <span className='text-sm font-semibold'>{model.name}</span>
          <span className='text-muted-foreground text-xs'>{model.vendor}</span>
        </div>
      ))}
    </div>
  )

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32'>
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(124,58,237,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_52%_at_50%_42%,black_18%,transparent_90%)] bg-[size:4rem_4rem] opacity-40 dark:opacity-35'
      />
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-14 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Why flatkey')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('One place for access,')}
            <br />
            {t('pricing, and control')}
          </h2>
        </AnimateInView>

        <div className='grid gap-5 md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 100}
              animation='scale-in'
              className='group min-h-[220px] rounded-xl border border-violet-500/15 bg-white/80 p-7 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.72)] backdrop-blur-sm transition-colors duration-300 hover:border-violet-500/30 hover:bg-white md:p-8 dark:bg-white/[0.035] dark:hover:bg-white/[0.055]'
            >
              <div
                className={cn(
                  'mb-8 flex size-16 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-[1.03]',
                  f.iconClass
                )}
              >
                {f.icon}
              </div>
              <h3 className='mb-4 text-xl font-semibold tracking-tight'>
                {f.title}
              </h3>
              <p className='text-muted-foreground text-sm leading-7 md:text-[15px]'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView className='mt-20 md:mt-24'>
          <h3 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('Recommended AI models')}
          </h3>
          <p className='text-muted-foreground mt-3 text-sm md:text-base'>
            {t('Curated top models selected by the flatkey community')}
          </p>
        </AnimateInView>

        <div className='mt-8 grid gap-5 lg:grid-cols-4'>
          {recommendedModels.map((model, i) => (
            <AnimateInView
              key={model.name}
              delay={i * 80}
              animation='fade-up'
              className='group relative min-h-[270px] overflow-hidden rounded-xl border border-violet-200/50 bg-slate-950 shadow-[0_24px_72px_-34px_rgba(88,28,135,0.82)] transition-transform duration-300 hover:-translate-y-1 dark:border-violet-300/15'
            >
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-br opacity-95',
                  model.visual
                )}
              />
              <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.45),transparent_28%),linear-gradient(to_top,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.54)_38%,rgba(2,6,23,0.08)_76%)]' />
              <div
                className={cn(
                  'absolute top-12 left-1/2 size-28 -translate-x-1/2 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125',
                  model.glow
                )}
              />
              <div className='absolute inset-x-0 bottom-0 p-6 text-white'>
                <h4 className='text-[21px] leading-tight font-bold tracking-tight xl:text-2xl'>
                  {model.name}
                </h4>
                <div className='mt-3 font-mono text-lg font-semibold text-white/90'>
                  {model.price}
                </div>
                <div className='mt-5 flex flex-wrap gap-2'>
                  {model.tags.map((tag) => (
                    <span
                      key={tag}
                      className='rounded-full border border-white/20 bg-slate-950/45 px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-sm'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView
          animation='fade-up'
          className='home-model-marquee group relative mt-6 overflow-hidden rounded-xl border border-violet-500/15 bg-white/80 py-3 shadow-[0_18px_54px_-40px_rgba(91,33,182,0.75)] backdrop-blur-sm dark:bg-white/[0.035]'
        >
          <div className='pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white via-white/85 to-transparent dark:from-[#080915] dark:via-[#080915]/88' />
          <div className='pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white via-white/85 to-transparent dark:from-[#080915] dark:via-[#080915]/88' />
          <div className='home-model-marquee-track flex w-max gap-3'>
            {renderTickerItems(0)}
            {renderTickerItems(1)}
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
