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
import { Gauge, Receipt, Sparkles, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  // Four cards aligned to onboarding-v2 §7.1 user-benefit list:
  //   1) WeChat/Alipay payment   2) one account = every model
  //   3) pay-as-you-go           4) ICP-registered, invoices
  // Bento grid uses 1+2 / 2+1 column spans so visual rhythm matches old.
  const features = [
    {
      id: 'cny-pay',
      num: '01',
      title: t('Pay in CNY'),
      desc: t(
        'WeChat or Alipay, from $5. No overseas credit card. No exchange-rate guesswork.'
      ),
      span: 'md:col-span-1',
      icon: <Wallet className='text-accent size-4' />,
      visual: (
        <div className='mt-4 flex flex-wrap items-center gap-2 text-xs'>
          <span className='border-border bg-card/70 text-muted-foreground rounded-md border px-2.5 py-1.5'>
            {t('WeChat Pay')}
          </span>
          <span className='border-border bg-card/70 text-muted-foreground rounded-md border px-2.5 py-1.5'>
            {t('Alipay')}
          </span>
        </div>
      ),
    },
    {
      id: 'one-account',
      num: '02',
      title: t('One account, every major AI'),
      desc: t(
        'GPT-5, Claude, Gemini, DeepSeek, Kimi, Qwen — call them all with one API key. No separate signups with each provider.'
      ),
      span: 'md:col-span-2',
      icon: <Sparkles className='text-success size-4' />,
      visual: (
        <div className='mt-4 grid grid-cols-3 gap-2 md:grid-cols-4'>
          {[
            'OpenAI',
            'Anthropic',
            'Google',
            'DeepSeek',
            'Moonshot',
            'Alibaba',
            'xAI',
            'Mistral',
          ].map((name) => (
            <div
              key={name}
              className='border-border bg-card/70 text-muted-foreground hover:border-accent/30 hover:bg-accent/5 flex items-center justify-center rounded-[7px] border px-3 py-2 text-xs transition-colors duration-300'
            >
              {name}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'pay-per-use',
      num: '03',
      title: t('Pay only for what you use'),
      desc: t(
        'No subscription. Every call shows the exact charge in your billing history.'
      ),
      span: 'md:col-span-2',
      icon: <Gauge className='text-accent size-4' />,
      visual: (
        <div className='mt-4 space-y-2'>
          {[t('Top up $5'), t('Call any model'), t('See per-call charge')].map(
            (step, i) => (
              <div key={step} className='flex items-center gap-2'>
                <div
                  className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    i === 2
                      ? 'border-accent/30 bg-accent/10 text-accent border'
                      : 'border-border/40 bg-muted text-muted-foreground border'
                  }`}
                >
                  {i + 1}
                </div>
                <div className='bg-border/40 h-px flex-1' />
                <span className='text-muted-foreground text-xs'>{step}</span>
              </div>
            )
          )}
        </div>
      ),
    },
    {
      id: 'invoice',
      num: '04',
      title: t('Invoice on request'),
      desc: t(
        'ICP-registered entity in mainland China. Business invoices available.'
      ),
      span: 'md:col-span-1',
      icon: <Receipt className='text-warning size-4' />,
      visual: (
        <div className='mt-4 flex items-center justify-center'>
          <div className='border-warning/20 bg-warning/10 flex size-16 items-center justify-center rounded-xl border'>
            <Receipt className='text-warning size-7' strokeWidth={1.5} />
          </div>
        </div>
      ),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase'>
            {t('Why DeepRouter')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-normal md:text-5xl'>
            {t('Pay in CNY.')}
            <br />
            {t('Skip the signup tax.')}
          </h2>
        </AnimateInView>

        {/* Bento grid */}
        <div className='border-border bg-border grid gap-px overflow-hidden rounded-xl border shadow-[0_12px_34px_rgb(28_28_28/0.06)] md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 100}
              animation='scale-in'
              className={`bg-card group hover:bg-card/80 p-7 transition-colors duration-300 md:p-8 ${f.span}`}
            >
              <div className='mb-3 flex items-center gap-3'>
                <span className='border-border bg-muted/60 text-muted-foreground flex size-7 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums'>
                  {f.num}
                </span>
                <h3 className='text-sm font-semibold'>{f.title}</h3>
              </div>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {f.desc}
              </p>
              {f.visual}
            </AnimateInView>
          ))}
        </div>

      </div>
    </section>
  )
}
