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
  ArrowRight01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'

export function DocsModelPricing() {
  const { t } = useTranslation()

  return (
    <DocsShell
      pageId='model-pricing'
      title={t('Model pricing and consumption')}
      description={t(
        'Select the correct model and endpoint, understand its billing rules, then verify the final charge in usage logs.'
      )}
      toc={[
        { id: 'find-model', label: t('Find a model') },
        { id: 'model-details', label: t('Read model details') },
        { id: 'billing-mode', label: t('Understand the billing mode') },
        { id: 'multipliers', label: t('Groups and dynamic pricing') },
        { id: 'verify-charge', label: t('Verify a real charge') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='find-model' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Find a model')}</h2>
        <NumberedSteps
          items={[
            t('Open the pricing page and search for the model you need.'),
            t(
              'Use search and the Provider and Pricing group filters to narrow the model list.'
            ),
            t(
              'Open More filters to filter by model tags, pricing type, and endpoint type.'
            ),
            t(
              'Switch currency, token unit, sort order, or card and table view when comparing prices.'
            ),
            t('Open the model details and copy its exact model ID.'),
            t(
              'Confirm at least one group available to your API key can use the model.'
            ),
          ]}
        />
        <Button className='mt-5' render={<Link to='/pricing' />}>
          {t('Open model pricing')}
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
        </Button>
      </section>

      <section id='model-details' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Read model details')}</h2>
        <NumberedSteps
          items={[
            t(
              'Use Overview to review model metadata, base price, group pricing, and any dynamic pricing rules.'
            ),
            t(
              'Use Performance to compare latency and uptime when performance data is available.'
            ),
            t(
              'Use API to choose a supported endpoint and view code samples, authentication, supported parameters, and rate limits.'
            ),
            t(
              'Copy the example for the endpoint you will call, then replace the API key and model placeholders.'
            ),
          ]}
        />
      </section>

      <section id='billing-mode' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Understand the billing mode')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Token-priced models calculate usage from billable input and output tokens. Cached input, images, and audio can have separate rates when shown.'
          )}
        </p>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Per-request models use the displayed unit, such as one generation, image count, duration, resolution, or quality. Read the model details before sending a large job.'
          )}
        </p>
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>
            {t('Do not estimate from the model name alone')}
          </AlertTitle>
          <AlertDescription>
            {t(
              'Two entries with similar names can use different endpoint types or billing units. Use the exact entry selected for your API key.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='multipliers' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Groups and dynamic pricing')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'The final charge can include the selected group multiplier. When multiple groups are available, confirm which group the API key is allowed to use.'
          )}
        </p>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Some models use dynamic or tiered pricing expressions based on request or response properties. The pricing page shows these rules with the model details when configured.'
          )}
        </p>
      </section>

      <section id='verify-charge' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Verify a real charge')}</h2>
        <NumberedSteps
          items={[
            t('Create an API key for the intended group.'),
            t(
              'Send a small non-streaming test request with the exact model ID.'
            ),
            t('Open usage logs and locate the request by time and model.'),
            t(
              'Review input, output, cache, media, group, and other billing details shown for the request.'
            ),
            t(
              'Use the logged final charge as the source of truth for that request.'
            ),
          ]}
        />
        <div className='mt-5 flex flex-wrap gap-3'>
          <Button variant='outline' render={<Link to='/keys' />}>
            {t('Open API keys')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button variant='outline' render={<Link to='/usage-logs' />}>
            {t('Open usage logs')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        </div>
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'If a model is unavailable, check the API key group and endpoint type filters.'
            ),
            t(
              'If the charge differs from a simple token estimate, review cache, media, group, and dynamic pricing details.'
            ),
            t(
              'If no usage log appears, confirm the request reached this service and used the expected API key.'
            ),
          ]}
        />
      </section>
    </DocsShell>
  )
}
