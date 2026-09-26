/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { CircleHelp, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const commonErrors = [
  {
    title: '401 · Unauthorized',
    body: 'Check that your API key is valid and sent as a Bearer token.',
  },
  {
    title: '404 · Model not found',
    body: 'Check the base URL and copy the model ID exactly as shown in the Model Square.',
  },
  {
    title: '429 · Too many requests',
    body: 'Check your account quota and request limits, then retry after a short pause.',
  },
  {
    title: '5xx · Upstream error',
    body: 'The selected provider may be temporarily unavailable. Retry later or choose another model.',
  },
]

export function DocsReferenceSections() {
  const { t } = useTranslation()

  return (
    <>
      <section id='api-reference' className='scroll-mt-24 space-y-5'>
        <div>
          <h2 className='text-2xl font-semibold tracking-tight'>
            {t('API reference')}
          </h2>
          <p className='text-muted-foreground mt-2 leading-7'>
            {t(
              'The API uses familiar OpenAI-compatible request formats. Available models and supported parameters can vary by provider.'
            )}
          </p>
        </div>
        <div className='border-border/70 overflow-hidden rounded-2xl border'>
          <div className='bg-muted/50 grid grid-cols-[100px_minmax(0,1fr)] gap-4 px-4 py-3 text-xs font-semibold tracking-wide uppercase sm:grid-cols-[110px_1fr_2fr]'>
            <span>{t('Method')}</span>
            <span>{t('Endpoint')}</span>
            <span className='hidden sm:block'>{t('Purpose')}</span>
          </div>
          <div className='divide-border/70 divide-y'>
            <div className='grid grid-cols-[100px_minmax(0,1fr)] gap-4 px-4 py-4 text-sm sm:grid-cols-[110px_1fr_2fr]'>
              <code className='text-primary'>POST</code>
              <code className='break-all'>/v1/chat/completions</code>
              <span className='text-muted-foreground col-span-2 sm:col-span-1'>
                {t('Send a chat completion request.')}
              </span>
            </div>
            <div className='grid grid-cols-[100px_minmax(0,1fr)] gap-4 px-4 py-4 text-sm sm:grid-cols-[110px_1fr_2fr]'>
              <code className='text-primary'>GET</code>
              <code className='break-all'>/v1/models</code>
              <span className='text-muted-foreground col-span-2 sm:col-span-1'>
                {t('List models available to your account.')}
              </span>
            </div>
          </div>
        </div>
        <p className='text-muted-foreground text-sm leading-6'>
          {t(
            'For model-specific capabilities and pricing, see the Model Square.'
          )}{' '}
          <Link to='/pricing' className='text-primary hover:underline'>
            {t('Browse models')}
          </Link>
          .
        </p>
      </section>

      <section id='security' className='scroll-mt-24 space-y-4'>
        <div className='flex items-center gap-3'>
          <KeyRound className='text-primary size-5' aria-hidden='true' />
          <h2 className='text-2xl font-semibold tracking-tight'>
            {t('Keep your key safe')}
          </h2>
        </div>
        <ul className='text-muted-foreground list-disc space-y-2 pl-5 leading-7'>
          <li>
            {t(
              'Store API keys in server-side environment variables; do not put them in browser code or public repositories.'
            )}
          </li>
          <li>
            {t(
              'Create separate keys for different apps, and revoke a key if it is exposed.'
            )}
          </li>
          <li>
            {t(
              'Check your account quota and the model square if a request is rejected.'
            )}
          </li>
        </ul>
      </section>

      <section id='troubleshooting' className='scroll-mt-24 space-y-5'>
        <div className='flex items-center gap-3'>
          <CircleHelp className='text-primary size-5' aria-hidden='true' />
          <h2 className='text-2xl font-semibold tracking-tight'>
            {t('Troubleshooting')}
          </h2>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          {commonErrors.map((item) => (
            <div
              key={item.title}
              className='border-border/70 bg-card rounded-xl border p-4'
            >
              <h3 className='font-medium'>{t(item.title)}</h3>
              <p className='text-muted-foreground mt-2 text-sm leading-6'>
                {t(item.body)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
