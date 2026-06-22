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
import { KeyRound, UserPlus, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  // 3 non-technical user steps aligned with onboarding-v2 §4 黄金路径
  // (Sign up → Top up → Use). Was previously dev-oriented (Configure /
  // Connect / Monitor with channel / API-route talk).
  const steps = [
    {
      num: '1',
      title: t('Sign up'),
      desc: t('30 seconds with WeChat scan or your phone number.'),
      icon: <UserPlus className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Top up'),
      desc: t('From $5 via WeChat Pay or Alipay. No overseas card.'),
      icon: <Wallet className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Use anywhere'),
      desc: t(
        'Copy your key, paste it into the AI tool you already use. One key, every supported model.'
      ),
      icon: <KeyRound className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='border-border relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase'>
            {t('How It Works')}
          </p>
          <h2 className='text-3xl font-bold tracking-normal md:text-5xl'>
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
                <div className='border-border bg-card text-muted-foreground flex size-16 items-center justify-center rounded-xl border shadow-[0_8px_24px_rgb(28_28_28/0.06)] transition-colors'>
                  {step.icon}
                </div>
                <div className='bg-accent text-accent-foreground absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full text-xs font-bold'>
                  {step.num}
                </div>
              </div>
              <h3 className='mb-2 text-base font-semibold'>{step.title}</h3>
              <p className='text-muted-foreground max-w-[240px] text-sm leading-relaxed'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
