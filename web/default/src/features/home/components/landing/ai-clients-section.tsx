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
import { ArrowRight01Icon, Download04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import ccSwitchLogo from '@/assets/home/cc-switch-logo.png'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { SectionHeading } from './section-heading'

type ProviderStateKey = 'Enabled' | 'Available' | 'Ready'
type ClientPreviewKind = 'codex' | 'claude' | 'gemini'

interface ProviderPreview {
  id: string
  mark: string
  name: string
  detail?: string
  detailKey?: string
  stateKey: ProviderStateKey
  selected?: boolean
}

interface ClientPreview {
  id: ClientPreviewKind
  mark: string
  name: string
  descriptionKey: string
}

const PROVIDER_PREVIEWS: ProviderPreview[] = [
  {
    id: 'alltokenapi',
    mark: 'A',
    name: 'AllTokenAPI',
    detail: 'https://alltokenapi.com',
    stateKey: 'Enabled',
    selected: true,
  },
  {
    id: 'anthropic',
    mark: 'AN',
    name: 'Anthropic',
    detail: 'Claude Code',
    stateKey: 'Available',
  },
  {
    id: 'openrouter',
    mark: 'OR',
    name: 'OpenRouter',
    detailKey: 'OpenAI Compatible',
    stateKey: 'Available',
  },
  {
    id: 'add-provider',
    mark: '+',
    name: 'Add Provider',
    detailKey: 'Import or configure manually',
    stateKey: 'Ready',
  },
]

const CLIENT_TABS = ['CC', 'CD', 'CX', 'G', 'OC', 'OA', 'H']

const CLIENT_PREVIEWS: ClientPreview[] = [
  {
    id: 'codex',
    mark: 'CX',
    name: 'Codex',
    descriptionKey: 'Task and code workspace',
  },
  {
    id: 'claude',
    mark: 'CL',
    name: 'Claude Code',
    descriptionKey: 'Terminal AI coding assistant',
  },
  {
    id: 'gemini',
    mark: 'G',
    name: 'Gemini CLI',
    descriptionKey: 'Command-line model workflow',
  },
]

const SUPPORTED_CLIENTS = [
  { mark: 'CC', name: 'Claude Code' },
  { mark: 'CD', name: 'Claude Desktop' },
  { mark: 'CX', name: 'Codex' },
  { mark: 'G', name: 'Gemini CLI' },
  { mark: 'OC', name: 'OpenCode' },
  { mark: 'OA', name: 'OpenClaw' },
  { mark: 'H', name: 'Hermes Agent' },
]

function CCSwitchStage() {
  const { t } = useTranslation()

  return (
    <Card className='grid gap-0 overflow-hidden rounded-lg py-0 shadow-sm lg:grid-cols-[0.8fr_1.2fr]'>
      <section className='border-border bg-orange-50/70 p-6 sm:p-8 lg:border-e lg:p-10 dark:bg-orange-950/15'>
        <div className='flex items-center gap-3'>
          <img
            src={ccSwitchLogo}
            alt='CC Switch'
            width={54}
            height={54}
            loading='lazy'
            decoding='async'
            className='size-13 shrink-0'
          />
          <strong className='text-xl'>CC Switch</strong>
        </div>

        <Badge variant='outline' className='bg-background/70 mt-7'>
          <span className='size-1.5 rounded-full bg-orange-500' />
          {t('Desktop client')}
        </Badge>

        <h3 className='mt-5 max-w-md text-2xl leading-tight font-semibold sm:text-[28px]'>
          {t('Manage your AI coding workflow in one place')}
        </h3>
        <p className='text-muted-foreground mt-4 max-w-md text-sm leading-7 sm:text-base'>
          {t(
            'Switch clients, providers, and model configurations in one interface.'
          )}
        </p>

        <div className='mt-7 flex flex-col gap-2.5 sm:flex-row'>
          <Button
            size='lg'
            className='h-11 w-full px-5 sm:w-auto'
            render={<Link to='/keys' />}
          >
            {t('One-click import')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button
            variant='outline'
            size='lg'
            className='bg-background/70 h-11 w-full px-5 sm:w-auto'
            render={
              <a
                href='https://github.com/farion1231/cc-switch/releases'
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          >
            <HugeiconsIcon icon={Download04Icon} data-icon='inline-start' />
            {t('Download CC Switch')}
          </Button>
        </div>

        <p className='text-muted-foreground mt-5 text-xs leading-5'>
          {t('Supports macOS 12+ · Windows 10+ · Linux')}
        </p>
      </section>

      <div className='bg-muted/60 p-4 sm:p-6 lg:p-7' aria-hidden='true'>
        <div className='border-border bg-background overflow-hidden rounded-lg border shadow-sm'>
          <div className='border-border flex h-10 items-center gap-1.5 border-b px-3'>
            <span className='size-2 rounded-full bg-red-400' />
            <span className='size-2 rounded-full bg-amber-400' />
            <span className='size-2 rounded-full bg-emerald-500' />
          </div>

          <div className='border-border flex min-h-14 flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-2 text-sm font-semibold'>
              <img
                src={ccSwitchLogo}
                alt=''
                width={24}
                height={24}
                loading='lazy'
                decoding='async'
                className='size-6'
              />
              <span className='text-primary'>CC Switch</span>
            </div>
            <div className='no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto'>
              {CLIENT_TABS.map((tab, index) => (
                <span
                  key={tab}
                  className={cn(
                    'bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-semibold',
                    index === 0 && 'bg-orange-500/10 text-orange-600'
                  )}
                >
                  {tab}
                </span>
              ))}
              <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-lg text-white'>
                +
              </span>
            </div>
          </div>

          <div className='grid gap-2.5 p-3 sm:p-4'>
            {PROVIDER_PREVIEWS.map((provider) => (
              <div
                key={provider.id}
                className={cn(
                  'border-border grid min-h-16 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3',
                  provider.selected && 'border-primary/50 bg-primary/5'
                )}
              >
                <span className='bg-muted text-foreground flex size-9 items-center justify-center rounded-lg font-mono text-[10px] font-semibold'>
                  {provider.mark}
                </span>
                <span className='min-w-0'>
                  <strong className='block truncate text-sm'>
                    {provider.name === 'Add Provider'
                      ? t('Add Provider')
                      : provider.name}
                  </strong>
                  <span className='text-primary mt-0.5 block truncate text-[11px]'>
                    {provider.detailKey
                      ? t(provider.detailKey)
                      : provider.detail}
                  </span>
                </span>
                <span className='text-success flex shrink-0 items-center gap-1.5 text-[11px] font-medium max-sm:col-start-2 max-sm:row-start-2'>
                  <span className='bg-success size-1.5 rounded-full' />
                  {t(provider.stateKey)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function ClientPreviewSurface(props: { kind: ClientPreviewKind }) {
  const { t } = useTranslation()

  if (props.kind === 'codex') {
    return (
      <div className='h-48 bg-neutral-950 p-4 text-neutral-100'>
        <div className='flex items-center justify-between font-mono text-[10px] text-blue-200'>
          <span>{t('Task')}</span>
          <span>gpt-5.6-sol</span>
        </div>
        <div className='mt-5 flex items-start gap-3'>
          <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 font-mono text-xs text-blue-300'>
            CX
          </span>
          <span className='flex min-w-0 flex-1 flex-col gap-2 pt-1'>
            <span className='h-2 w-full rounded-full bg-slate-600' />
            <span className='h-2 w-4/5 rounded-full bg-slate-600' />
            <span className='h-2 w-1/2 rounded-full bg-slate-600' />
          </span>
        </div>
      </div>
    )
  }

  if (props.kind === 'claude') {
    return (
      <div className='h-48 bg-neutral-950 p-4 font-mono text-[11px] text-neutral-100'>
        <div className='flex items-center justify-between text-[10px] text-blue-200'>
          <span>{t('Terminal')}</span>
          <span>claude-fable-5</span>
        </div>
        <div className='mt-5 flex flex-col gap-1.5'>
          <span>
            <span className='text-emerald-400'>$</span> claude
          </span>
          <span>{t('Connected to AllTokenAPI')}</span>
          <span className='text-blue-300'>
            {t('Ready for your next task.')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className='bg-primary/5 h-48 p-4'>
      <div className='border-primary/30 bg-background text-primary rounded-lg border px-3 py-2 font-mono text-[11px]'>
        &gt; {t('Analyze this project structure')}
      </div>
      <div className='mt-5 flex flex-col gap-2'>
        <span className='bg-primary/15 h-2 w-full rounded-full' />
        <span className='bg-primary/15 h-2 w-4/5 rounded-full' />
        <span className='bg-primary/15 h-2 w-3/5 rounded-full' />
      </div>
    </div>
  )
}

function ClientPreviewCard(props: { client: ClientPreview }) {
  const { t } = useTranslation()

  return (
    <Card className='gap-0 rounded-lg py-0'>
      <CardHeader className='border-border min-h-16 border-b py-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold text-white',
              props.client.id === 'codex' && 'bg-neutral-900',
              props.client.id === 'claude' && 'bg-orange-500',
              props.client.id === 'gemini' && 'bg-blue-600'
            )}
          >
            {props.client.mark}
          </span>
          <span className='min-w-0'>
            <CardTitle className='truncate text-sm'>
              {props.client.name}
            </CardTitle>
            <CardDescription className='mt-0.5 line-clamp-2 text-xs'>
              {t(props.client.descriptionKey)}
            </CardDescription>
          </span>
        </div>
      </CardHeader>
      <CardContent className='p-0'>
        <ClientPreviewSurface kind={props.client.id} />
      </CardContent>
    </Card>
  )
}

function CompatibilityStrip() {
  const { t } = useTranslation()

  return (
    <div className='border-border bg-card mt-3 flex flex-col gap-3 overflow-hidden rounded-lg border p-4 sm:flex-row sm:items-center'>
      <strong className='shrink-0 text-sm'>{t('Supported clients')}</strong>
      <div className='no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto'>
        {SUPPORTED_CLIENTS.map((client) => (
          <Badge key={client.name} variant='outline' className='shrink-0'>
            <span className='bg-muted flex size-5 items-center justify-center rounded-sm font-mono text-[9px]'>
              {client.mark}
            </span>
            {client.name}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export function AiClientsSection() {
  const { t } = useTranslation()

  return (
    <section className='bg-muted/30 px-4 py-16 sm:px-6 sm:py-20 lg:py-24'>
      <div className='mx-auto w-full max-w-6xl'>
        <SectionHeading
          eyebrow={t('AI clients')}
          title={t('Support multiple AI clients')}
          description={t(
            'One entry connects Claude Code, Codex, Gemini CLI, and other popular AI coding clients.'
          )}
        />

        <CCSwitchStage />

        <div className='mt-10 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:items-end sm:justify-between'>
          <h3 className='text-2xl font-semibold'>
            {t('Common client interfaces')}
          </h3>
          <p className='text-muted-foreground max-w-xl text-sm leading-6 sm:text-end'>
            {t(
              'Client previews are for compatibility display only; import configuration via CC Switch or the API Keys page.'
            )}
          </p>
        </div>

        <div className='mt-5 grid gap-3 md:grid-cols-3'>
          {CLIENT_PREVIEWS.map((client) => (
            <ClientPreviewCard key={client.id} client={client} />
          ))}
        </div>

        <CompatibilityStrip />
      </div>
    </section>
  )
}
