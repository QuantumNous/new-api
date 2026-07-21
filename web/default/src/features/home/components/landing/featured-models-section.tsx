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

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getLobeIcon } from '@/lib/lobe-icon'

import { SectionHeading } from './section-heading'

interface FeaturedModel {
  modelName: string
  provider: string
  icon: string
  inputPrice: string
  outputPrice?: string
  endpoint: string
  billingMode?: 'request'
}

interface FeaturedModelsSectionProps {
  catalogAvailable: boolean
}

const FEATURED_MODELS: FeaturedModel[] = [
  {
    modelName: 'gpt-5.6-sol',
    provider: 'OpenAI',
    icon: "OpenAI.Avatar.type={'gpt5'}.shape={'square'}",
    inputPrice: '$0.50',
    outputPrice: '$3.00',
    endpoint: '/v1/responses',
  },
  {
    modelName: 'claude-opus-4-6',
    provider: 'Anthropic',
    icon: 'Claude.Color',
    inputPrice: '$0.50',
    outputPrice: '$2.50',
    endpoint: '/v1/messages',
  },
  {
    modelName: 'claude-fable-5',
    provider: 'Anthropic',
    icon: 'Claude.Color',
    inputPrice: '$1.00',
    outputPrice: '$5.00',
    endpoint: '/v1/messages',
  },
  {
    modelName: 'grok-4.5',
    provider: 'xAI',
    icon: "Grok.Avatar.shape={'square'}",
    inputPrice: '$0.20',
    outputPrice: '$0.60',
    endpoint: '/v1/responses',
  },
  {
    modelName: 'gpt-image-2',
    provider: 'OpenAI',
    icon: 'Dalle.Color',
    inputPrice: '$0.50',
    endpoint: '/v1/images/generations',
    billingMode: 'request',
  },
  {
    modelName: 'gemini-3.1-pro-preview',
    provider: 'Google',
    icon: 'Gemini.Color',
    inputPrice: '$0.20',
    outputPrice: '$1.20',
    endpoint: '/v1beta/models/{model}:generateContent',
  },
]

function ModelPreviewCard(props: { model: FeaturedModel }) {
  const { t } = useTranslation()

  return (
    <Card className='h-full min-h-72 rounded-lg' data-card-hover='true'>
      <CardHeader>
        <div className='border-border/70 bg-background mb-3 flex size-11 items-center justify-center overflow-hidden rounded-lg border shadow-xs'>
          {getLobeIcon(props.model.icon, 30)}
        </div>
        <CardTitle className='truncate text-lg'>
          {props.model.modelName}
        </CardTitle>
        <CardAction>
          <Badge variant='outline'>{props.model.provider}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className='mt-auto grid grid-cols-2 gap-4'>
        <div>
          <p className='text-muted-foreground text-xs'>
            {props.model.billingMode === 'request' ? t('Price') : t('Input')}
          </p>
          <p className='mt-1 font-mono text-sm font-semibold tabular-nums'>
            {props.model.inputPrice}
          </p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>
            {props.model.billingMode === 'request' ? t('Billing') : t('Output')}
          </p>
          <p className='mt-1 truncate font-mono text-sm font-semibold tabular-nums'>
            {props.model.billingMode === 'request'
              ? t('Per request')
              : props.model.outputPrice}
          </p>
        </div>
      </CardContent>

      <CardFooter className='justify-between gap-3'>
        <span className='text-muted-foreground text-xs'>
          {props.model.billingMode === 'request'
            ? t('Image')
            : t('Per 1M tokens')}
        </span>
        <span
          className='text-muted-foreground max-w-40 truncate text-xs'
          title={props.model.endpoint}
        >
          {props.model.endpoint}
        </span>
      </CardFooter>
    </Card>
  )
}

export function FeaturedModelsSection(props: FeaturedModelsSectionProps) {
  const { t } = useTranslation()
  const targetPath = props.catalogAvailable ? '/pricing' : '/docs'

  return (
    <section className='px-4 py-16 sm:px-6 sm:py-20 lg:py-24'>
      <div className='mx-auto w-full max-w-6xl'>
        <SectionHeading
          eyebrow={t('Featured models')}
          title={t('Find the right model for every task.')}
        />

        <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
          {FEATURED_MODELS.map((model) => (
            <Link
              key={model.modelName}
              to={targetPath}
              className='focus-visible:ring-ring/50 group block rounded-lg focus-visible:ring-[3px] focus-visible:outline-none'
            >
              <ModelPreviewCard model={model} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
