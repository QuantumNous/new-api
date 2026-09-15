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
import { useTranslation } from 'react-i18next'

export function Privacy() {
  const { t } = useTranslation()

  const cards: Array<{
    kicker: string
    title: string
    body: string
    href: '/privacy-policy' | '/pricing'
    action: string
  }> = [
    {
      kicker: 'request.log',
      title: t('Application records'),
      body: t(
        'Usage and billing metadata are retained so you can inspect spend. Prompt and response bodies follow your deployment settings.'
      ),
      href: '/privacy-policy',
      action: t('Read the privacy policy'),
    },
    {
      kicker: t('Optional caching'),
      title: t('Prompt caching'),
      body: t(
        'Cache controls pass through when the selected model supports them.'
      ),
      href: '/privacy-policy',
      action: t('Read the privacy policy'),
    },
    {
      kicker: t('Upstream providers'),
      title: t('One route per request'),
      body: t(
        'Each request reaches only the provider selected to serve that route.'
      ),
      href: '/pricing',
      action: t('See our live catalog rates'),
    },
  ]

  return (
    <section className='px-4 py-16 sm:px-6 md:py-24'>
      <div className='mx-auto max-w-5xl'>
        <h2 className='ci-display text-[clamp(2.2rem,5vw,4.2rem)] text-[var(--ci-ink)]'>
          {t('Your data boundaries, clearly explained.')}
        </h2>
        <p className='text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed'>
          {t(
            'See what this gateway records, where caching can occur, and which models your keys can reach.'
          )}
        </p>
        <div className='mt-10 grid gap-4 md:grid-cols-3'>
          {cards.map((card) => (
            <Link
              key={card.title}
              to={card.href}
              className='hover:bg-muted/40 flex flex-col rounded-2xl border bg-[var(--ci-surface)] p-5 transition-colors'
            >
              <p className='ci-mono text-muted-foreground text-xs'>
                {card.kicker}
              </p>
              <h3 className='mt-4 text-lg font-semibold tracking-tight'>
                {card.title}
              </h3>
              <p className='text-muted-foreground mt-2 flex-1 text-sm leading-relaxed'>
                {card.body}
              </p>
              <span className='mt-5 text-sm font-medium'>{card.action}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
