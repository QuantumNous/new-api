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

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { buttonVariants } from '@/components/ui/button'
import { TOKENINFRA_PYTHON_EXAMPLE } from '@/features/home/components/tokeninfra-developers'
import { useStatus } from '@/hooks/use-status'

export function QuickStartContent(props: { apiBaseUrl: string }) {
  const { t } = useTranslation()

  return (
    <main className='mx-auto w-full max-w-4xl px-6 pt-32 pb-20'>
      <p className='text-primary mb-4 text-sm font-medium'>
        TokenInfra / {t('Docs')}
      </p>
      <h1 className='mb-5 text-4xl font-semibold tracking-tight'>
        {t('TokenInfra quick start')}
      </h1>
      <p className='text-muted-foreground mb-12 leading-8'>
        {t(
          'Create an API key, configure the OpenAI SDK, and send your first request to TokenInfra.'
        )}
      </p>
      <div className='space-y-12'>
        <section aria-labelledby='quickstart-key'>
          <h2 id='quickstart-key' className='mb-4 text-xl font-semibold'>
            01 / {t('Create an API key')}
          </h2>
          <p className='text-muted-foreground mb-5 leading-8'>
            {t(
              'Sign in, create a key in API Keys, and select a model available to your account in Model Square. Keep the key on your server, never in browser code.'
            )}
          </p>
          <div className='flex flex-wrap gap-3'>
            <Link to='/keys' className={buttonVariants()}>
              {t('API Keys')}
            </Link>
            <Link
              to='/pricing'
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('Model Square')}
            </Link>
          </div>
        </section>
        <section aria-labelledby='quickstart-config'>
          <h2 id='quickstart-config' className='mb-4 text-xl font-semibold'>
            02 / {t('Configure')}
          </h2>
          <p className='text-muted-foreground mb-4 leading-8'>
            {t(
              'Install the OpenAI Python SDK and set these environment variables in your terminal. Replace the key placeholder with your own key.'
            )}
          </p>
          <p className='mb-4 text-sm'>
            <span className='text-muted-foreground'>Base URL: </span>
            <code className='break-all'>{props.apiBaseUrl}</code>
          </p>
          <pre
            tabIndex={0}
            aria-label={t('Configure')}
            className='bg-muted overflow-x-auto rounded-xl border p-5 text-xs leading-7 sm:text-sm'
          >
            <code>{`python -m pip install openai\n\nexport TOKENINFRA_API_KEY="YOUR_API_KEY"\nexport TOKENINFRA_BASE_URL="${props.apiBaseUrl}"`}</code>
          </pre>
        </section>
        <section aria-labelledby='quickstart-request'>
          <h2 id='quickstart-request' className='mb-4 text-xl font-semibold'>
            03 / {t('Send your first request')}
          </h2>
          <p className='text-muted-foreground mb-4 leading-8'>
            {t(
              'Save the example as quickstart.py, replace deepseek-chat with an available model ID, then run python quickstart.py. A successful request prints the model reply.'
            )}
          </p>
          <pre
            tabIndex={0}
            aria-label={t('API example')}
            className='overflow-x-auto rounded-xl bg-slate-900 p-5 text-xs leading-7 text-blue-100 sm:text-sm'
          >
            <code>{TOKENINFRA_PYTHON_EXAMPLE}</code>
          </pre>
          <p className='text-muted-foreground mt-5 text-sm leading-7'>
            {t(
              'If the request fails, check your API key, account balance, model permissions and API base URL. View usage and request logs in the console.'
            )}
          </p>
        </section>
      </div>
    </main>
  )
}

export function QuickStart() {
  const { status } = useStatus()
  const serverAddress =
    typeof status?.server_address === 'string' && status.server_address.trim()
      ? status.server_address.trim()
      : window.location.origin
  const baseUrl = serverAddress.replace(/\/+$/, '')

  return (
    <PublicLayout showMainContainer={false}>
      <QuickStartContent
        apiBaseUrl={baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`}
      />
      <Footer />
    </PublicLayout>
  )
}
