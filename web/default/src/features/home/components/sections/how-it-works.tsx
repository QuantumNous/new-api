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
import { Settings, KeyRound, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Home step configure title'),
      desc: t('Home step configure description'),
      icon: <Settings className='size-6 text-blue-400' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Home step connect title'),
      desc: t('Home step connect description'),
      icon: <KeyRound className='size-6 text-violet-400' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Home step monitor title'),
      desc: t('Home step monitor description'),
      icon: (
        <BarChart3 className='size-6 text-purple-400' strokeWidth={1.5} />
      ),
    },
  ]

  return (
    <section className='relative z-10 border-t border-white/10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='mb-3 text-xs font-medium tracking-widest text-violet-300/80 uppercase'>
            {t('How It Works')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight text-slate-50 md:text-3xl'>
            {t('Three steps to get started')}
          </h2>
        </AnimateInView>

        <div className='grid gap-8 md:grid-cols-3 md:gap-12'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 150}
              animation='fade-up'
              className='relative flex flex-col items-center text-center'
            >
              <div className='relative mb-6'>
                <div className='flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-colors'>
                  {step.icon}
                </div>
                <div className='absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white'>
                  {step.num}
                </div>
              </div>
              <h3 className='mb-2 text-base font-semibold text-slate-100'>
                {step.title}
              </h3>
              <p className='max-w-[260px] text-sm leading-relaxed text-slate-400'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
