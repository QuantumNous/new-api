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
import { Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'

const chatExample = `curl https://your-api.example.com/v1/chat/completions \\
  -H "Authorization: Bearer $NEW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model-id",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`

const steps = [
  {
    title: 'Create an API key',
    body: 'Open the Console, go to API Keys, and create a key for your app.',
  },
  {
    title: 'Choose a model',
    body: 'Browse the Model Square and copy the exact model ID you want to use.',
  },
  {
    title: 'Send a request',
    body: 'Use your service address as the base URL and append the endpoint path.',
  },
]

export function DocsQuickStart() {
  const { t } = useTranslation()

  return (
    <section id='quick-start' className='scroll-mt-24 space-y-6'>
      <div>
        <p className='text-primary mb-2 text-sm font-medium'>
          {t('Start here')}
        </p>
        <h2 className='text-2xl font-semibold tracking-tight'>
          {t('Quick start')}
        </h2>
      </div>

      <ol className='grid gap-4 md:grid-cols-3'>
        {steps.map((step, index) => (
          <li
            key={step.title}
            className='border-border/70 bg-card rounded-2xl border p-5'
          >
            <span className='bg-primary/10 text-primary mb-4 inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold'>
              {index + 1}
            </span>
            <h3 className='font-medium'>{t(step.title)}</h3>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              {t(step.body)}
            </p>
          </li>
        ))}
      </ol>

      <div className='border-border/70 bg-card rounded-2xl border p-5 sm:p-6'>
        <div className='mb-4 flex items-start gap-3'>
          <Terminal
            className='text-primary mt-0.5 size-5 shrink-0'
            aria-hidden='true'
          />
          <div>
            <h3 className='font-medium'>{t('Example request')}</h3>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t(
                'Replace the sample address, key, and model ID with values from your account.'
              )}
            </p>
          </div>
          <CopyButton
            value={chatExample}
            className='ml-auto'
            tooltip={t('Copy example')}
            successTooltip={t('Example copied')}
            aria-label={t('Copy example request')}
          />
        </div>
        <pre className='bg-muted/60 overflow-x-auto rounded-xl p-4 text-xs leading-6 sm:text-sm'>
          <code>{chatExample}</code>
        </pre>
      </div>
    </section>
  )
}
