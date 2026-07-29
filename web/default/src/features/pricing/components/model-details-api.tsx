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
import { CheckCircle2, ExternalLink, PlugZap, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BundledLanguage } from 'shiki/bundle/web'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildIntegrationSample,
  integrationPath,
  type SampleLanguage,
} from '@/features/integrations/sample-builder'
import { useStatus } from '@/hooks/use-status'

import type { IntegrationProfile, PricingModel } from '../types'

const LANGUAGES: Array<{
  value: SampleLanguage
  label: string
  syntax: BundledLanguage
}> = [
  { value: 'curl', label: 'cURL', syntax: 'bash' },
  { value: 'python', label: 'Python', syntax: 'python' },
  { value: 'typescript', label: 'TypeScript', syntax: 'typescript' },
  { value: 'javascript', label: 'JavaScript', syntax: 'javascript' },
]

export function ModelDetailsApi(props: {
  model: PricingModel
  integrationProfiles: IntegrationProfile[]
}) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const integrations = useMemo(
    () =>
      (props.model.integrations ?? [])
        .filter(
          (integration) =>
            integration.verified && integration.source === 'explicit'
        )
        .flatMap((integration) => {
          const profile = props.integrationProfiles.find(
            (candidate) => candidate.id === integration.profile_id
          )
          return profile ? [{ integration, profile }] : []
        }),
    [props.integrationProfiles, props.model.integrations]
  )
  const [profileId, setProfileId] = useState(integrations[0]?.profile.id ?? '')
  const [language, setLanguage] = useState<SampleLanguage>('curl')
  const selected =
    integrations.find((item) => item.profile.id === profileId) ??
    integrations[0]

  if (!selected) {
    return (
      <EmptyState
        icon={PlugZap}
        className='min-h-[180px]'
        title={t('Integration details have not been verified')}
        action={
          <Link
            to='/docs/$slug'
            params={{ slug: 'getting-started' }}
            className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
          >
            {t('View getting started guide')}{' '}
            <ExternalLink className='size-3.5' />
          </Link>
        }
      />
    )
  }

  const statusRecord = status as Record<string, unknown> | null
  const baseUrl =
    (typeof statusRecord?.server_address === 'string' &&
      statusRecord.server_address.replace(/\/$/, '')) ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const languageMeta =
    LANGUAGES.find((item) => item.value === language) ?? LANGUAGES[0]
  const sample = buildIntegrationSample(
    selected.profile,
    props.model.model_name,
    language,
    baseUrl
  )

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-center gap-2'>
        <Tabs value={selected.profile.id} onValueChange={setProfileId}>
          <TabsList className='h-auto flex-wrap'>
            {integrations.map((item) => (
              <TabsTrigger key={item.profile.id} value={item.profile.id}>
                {t(item.profile.name_key)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {selected.integration.verified ? (
          <Badge className='gap-1'>
            <ShieldCheck className='size-3' />
            {t('Verified')}
          </Badge>
        ) : (
          <Badge variant='secondary' className='gap-1'>
            <CheckCircle2 className='size-3' />
            {t('Compatibility inferred')}
          </Badge>
        )}
      </div>

      <dl className='grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2'>
        <div>
          <dt className='text-muted-foreground'>{t('Protocol')}</dt>
          <dd>{selected.profile.protocol}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Route')}</dt>
          <dd className='font-mono text-xs'>
            {selected.profile.method}{' '}
            {integrationPath(selected.profile, props.model.model_name)}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Authentication')}</dt>
          <dd>{selected.profile.auth_scheme}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Streaming')}</dt>
          <dd>
            {selected.profile.streaming ? t('Supported') : t('Not supported')}
          </dd>
        </div>
        <div className='sm:col-span-2'>
          <dt className='text-muted-foreground'>{t('Group scope')}</dt>
          <dd>
            {selected.integration.groups.length > 0
              ? selected.integration.groups.join(', ')
              : t('All available groups')}
          </dd>
        </div>
      </dl>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Tabs
          value={language}
          onValueChange={(value) => setLanguage(value as SampleLanguage)}
        >
          <TabsList>
            {LANGUAGES.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Link
          to='/docs/$slug'
          params={{ slug: selected.profile.docs_slug }}
          className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
        >
          {t('Full integration guide')} <ExternalLink className='size-3.5' />
        </Link>
      </div>
      <CodeBlock code={sample} language={languageMeta.syntax}>
        <CodeBlockCopyButton />
      </CodeBlock>
    </div>
  )
}
