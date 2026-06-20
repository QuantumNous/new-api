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
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  GitBranch,
  KeyRound,
  Route,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'

function DefaultAboutContent() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  const capabilities = [
    {
      icon: Route,
      title: t('Unified provider routing'),
      desc: t(
        'Connect OpenAI-compatible APIs, Claude, Gemini, and other upstream services behind one stable gateway.'
      ),
    },
    {
      icon: KeyRound,
      title: t('Key and quota control'),
      desc: t(
        'Issue API keys, assign groups, enforce quotas, and keep access policies manageable as usage grows.'
      ),
    },
    {
      icon: WalletCards,
      title: t('Usage and billing clarity'),
      desc: t(
        'Track requests, tokens, model pricing, balances, and settlement data from the same operating surface.'
      ),
    },
    {
      icon: BarChart3,
      title: t('Operational visibility'),
      desc: t(
        'Review logs, latency, costs, and channel health so routing decisions stay observable and accountable.'
      ),
    },
  ]

  const stats = [
    ['40+', t('Provider coverage')],
    ['99.9%', t('Availability target')],
    ['320ms', t('Observed latency')],
    ['$2.5k', t('Monthly cost visibility')],
  ]

  const routeNodes = [
    ['GPT-4o', '60%', t('Primary lane')],
    ['Claude 3.5', '30%', t('Quality lane')],
    ['Llama 3.1', '10%', t('Fallback lane')],
  ]

  return (
    <>
      <section className='relative overflow-hidden px-6 pt-28 pb-14 md:pt-32 md:pb-20'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_50%_0%,rgb(37_99_255/0.14),transparent_34%),linear-gradient(180deg,rgb(252_251_248),transparent_78%)]'
        />
        <div className='mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]'>
          <div>
            <div className='border-border bg-card/80 mb-7 inline-flex h-16 items-center rounded-xl border px-5 py-2 shadow-[0_10px_28px_rgb(28_28_28/0.06)] backdrop-blur'>
              <img
                src='/logo-full.png'
                alt='DeepRouter'
                className='h-11 w-[240px] rounded-none object-contain object-left sm:w-[300px]'
              />
            </div>
            <h1 className='max-w-3xl text-[clamp(2.7rem,5.8vw,5.25rem)] leading-[0.98] font-bold tracking-normal'>
              {t('Intelligent routing for AI.')}
            </h1>
            <p className='text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed md:text-lg'>
              {t(
                'DeepRouter is an AI API gateway for teams that need one reliable control plane across models, providers, keys, quotas, billing, and logs.'
              )}
            </p>
            <div className='mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4'>
              {stats.map(([value, label]) => (
                <div
                  key={label}
                  className='border-border bg-card/80 rounded-xl border px-4 py-3 shadow-[0_10px_26px_rgb(28_28_28/0.05)]'
                >
                  <p className='text-lg font-bold tabular-nums'>{value}</p>
                  <p className='text-muted-foreground mt-1 text-xs leading-tight'>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className='border-border bg-card/85 rounded-2xl border p-4 shadow-[0_24px_70px_rgb(28_28_28/0.12)] backdrop-blur md:p-5'>
            <div className='border-border bg-background/70 rounded-xl border'>
              <div className='border-border flex items-center justify-between border-b px-5 py-4'>
                <div>
                  <p className='text-muted-foreground text-xs font-semibold tracking-widest uppercase'>
                    {t('Gateway overview')}
                  </p>
                  <h2 className='mt-1 text-xl font-bold md:text-2xl'>
                    {t('One route, many models')}
                  </h2>
                </div>
                <div className='bg-accent/10 text-accent flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold'>
                  <Activity className='size-3.5' />
                  {t('Live policy')}
                </div>
              </div>

              <div className='p-5'>
                <div className='grid items-center gap-4 md:grid-cols-[0.7fr_0.55fr_1fr]'>
                  <div className='border-border bg-card rounded-xl border p-4 shadow-[0_10px_28px_rgb(28_28_28/0.05)]'>
                    <p className='text-muted-foreground text-xs font-medium'>
                      {t('Incoming request')}
                    </p>
                    <div className='mt-4 flex items-center gap-3'>
                      <div className='bg-accent size-2.5 rounded-full' />
                      <div className='bg-accent/60 h-px flex-1' />
                    </div>
                    <p className='mt-4 text-sm font-semibold'>
                      chat.completions
                    </p>
                  </div>

                  <div className='mx-auto flex flex-col items-center gap-2 text-center'>
                    <div className='bg-foreground text-background flex size-20 items-center justify-center rounded-2xl shadow-[0_16px_36px_rgb(28_28_28/0.22)]'>
                      <Route className='size-8' strokeWidth={1.8} />
                    </div>
                    <p className='text-muted-foreground text-xs font-medium'>
                      {t('Router policy')}
                    </p>
                  </div>

                  <div className='space-y-3'>
                    {routeNodes.map(([name, percent, label]) => (
                      <div
                        key={name}
                        className='border-border bg-card relative flex items-center justify-between overflow-hidden rounded-xl border px-4 py-3 shadow-[0_10px_28px_rgb(28_28_28/0.05)]'
                      >
                        <div
                          aria-hidden
                          className='bg-accent/10 absolute inset-y-0 left-0'
                          style={{ width: percent }}
                        />
                        <div className='relative flex items-center gap-3'>
                          <div className='border-accent/20 bg-accent/10 text-accent flex size-8 items-center justify-center rounded-lg border'>
                            <DatabaseZap className='size-4' />
                          </div>
                          <div>
                            <p className='text-sm font-semibold'>{name}</p>
                            <p className='text-muted-foreground text-xs'>
                              {label}
                            </p>
                          </div>
                        </div>
                        <span className='text-accent relative text-sm font-bold tabular-nums'>
                          {percent}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='mt-5 grid gap-3 sm:grid-cols-3'>
                  <div className='border-border bg-card rounded-xl border px-4 py-3'>
                    <Clock3 className='text-accent mb-2 size-4' />
                    <p className='text-sm font-semibold'>320ms</p>
                    <p className='text-muted-foreground text-xs'>
                      {t('Avg. latency')}
                    </p>
                  </div>
                  <div className='border-border bg-card rounded-xl border px-4 py-3'>
                    <CheckCircle2 className='mb-2 size-4 text-emerald-600' />
                    <p className='text-sm font-semibold'>99.9%</p>
                    <p className='text-muted-foreground text-xs'>
                      {t('Success rate')}
                    </p>
                  </div>
                  <div className='border-border bg-card rounded-xl border px-4 py-3'>
                    <GitBranch className='text-accent mb-2 size-4' />
                    <p className='text-sm font-semibold'>{t('Health aware')}</p>
                    <p className='text-muted-foreground text-xs'>
                      {t('Automatic fallback')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='px-6 py-14 md:py-20'>
        <div className='mx-auto max-w-6xl'>
          <div className='flex flex-col justify-between gap-5 md:flex-row md:items-end'>
            <div>
              <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase'>
                {t('Why DeepRouter')}
              </p>
              <h2 className='max-w-2xl text-3xl leading-tight font-bold tracking-normal md:text-5xl'>
                {t('A calm control plane for AI API operations.')}
              </h2>
            </div>
            <p className='text-muted-foreground max-w-sm text-sm leading-relaxed'>
              {t('Route requests by policy, cost, health, and availability.')}
            </p>
          </div>
          <div className='mt-10 grid gap-4 md:grid-cols-4'>
            {capabilities.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className='border-border bg-card group rounded-2xl border p-6 shadow-[0_12px_34px_rgb(28_28_28/0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgb(28_28_28/0.08)]'
                >
                  <div className='border-border bg-background text-accent group-hover:border-accent/30 group-hover:bg-accent/10 mb-5 flex size-12 items-center justify-center rounded-xl border transition'>
                    <Icon className='size-5' strokeWidth={1.7} />
                  </div>
                  <h3 className='text-base font-semibold'>{item.title}</h3>
                  <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className='border-border bg-card/45 border-y px-6 py-14 md:py-20'>
        <div className='mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.9fr_1.1fr]'>
          <div>
            <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase'>
              {t('Project foundation')}
            </p>
            <h2 className='text-3xl leading-tight font-bold tracking-normal md:text-4xl'>
              {t('Built for self-hosted and transparent deployments.')}
            </h2>
          </div>
          <div className='text-muted-foreground space-y-5 text-sm leading-relaxed md:text-base'>
            <p>
              {t(
                'DeepRouter focuses on practical API gateway work: unified request handling, provider fallback, account controls, usage logs, and billing workflows for teams operating AI products.'
              )}
            </p>
            <p>
              {t(
                'Administrators can still replace this page with custom HTML or an external URL from system settings when a deployment needs its own company profile.'
              )}
            </p>
            <div className='grid gap-3 pt-2 sm:grid-cols-2'>
              {[t('Self-hosted first'), t('Transparent operations')].map(
                (item) => (
                  <div
                    key={item}
                    className='border-border bg-background text-foreground flex items-center gap-3 rounded-xl border px-4 py-3'
                  >
                    <CheckCircle2 className='size-4 text-emerald-600' />
                    <span className='text-sm font-semibold'>{item}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <section className='px-6 py-7'>
        <div className='border-border text-muted-foreground mx-auto max-w-6xl border-t pt-5 text-[11px] leading-relaxed'>
          <p className='mb-2 font-medium'>{t('Open source attribution')}</p>
          <p>
            {t('New API Project Repository:')}{' '}
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-accent underline-offset-2 hover:underline'
            >
              {t('https://github.com/QuantumNous/new-api')}
            </a>
          </p>
          <p>
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-accent underline-offset-2 hover:underline'
            >
              {t('NewAPI')}
            </a>{' '}
            © {currentYear}{' '}
            <a
              href='https://github.com/QuantumNous'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-accent underline-offset-2 hover:underline'
            >
              {t('QuantumNous')}
            </a>{' '}
            {t('| Based on')}{' '}
            <a
              href='https://github.com/songquanpeng/one-api'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-accent underline-offset-2 hover:underline'
            >
              {t('One API')}
            </a>{' '}
            © 2023{' '}
            <a
              href='https://github.com/songquanpeng'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-accent underline-offset-2 hover:underline'
            >
              {t('JustSong')}
            </a>
            . {t('This project must be used in compliance with the')}{' '}
            <a
              href='https://github.com/QuantumNous/new-api/blob/main/LICENSE'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-accent underline-offset-2 hover:underline'
            >
              {t('AGPL v3.0 License')}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  )
}

export function About() {
  // DeepRouter brand About page is the single source of truth. The backend
  // /api/about system setting is intentionally ignored so a stray admin value
  // can never blank out or override this page.
  return (
    <PublicLayout showMainContainer={false}>
      <DefaultAboutContent />
      <Footer />
    </PublicLayout>
  )
}
