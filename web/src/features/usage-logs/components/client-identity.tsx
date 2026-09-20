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
import { Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

export interface ClientSnapshot {
  client_key: string
  family: string
  variant: string
  display_name: string
  version: string
  confidence: string
  user_agent: string
  truncated: boolean
}

const gradients: Record<string, string> = {
  codex: 'from-zinc-500/20 dark:from-zinc-300/15',
  claude_code: 'from-orange-500/15',
  pi: 'from-blue-500/15',
  opencode: 'from-purple-500/15',
  newapi: 'from-cyan-600/15',
  zcode: 'from-gray-500/15',
  dsh: 'from-blue-500/15',
}

function ClientIcon(props: { family: string }) {
  const icons: Record<string, string> = {
    codex: 'Codex',
    claude_code: 'ClaudeCode',
    opencode: 'OpenCode',
    newapi: 'NewAPI',
    dsh: 'DeepSeek',
    openclaw: 'OpenClaw',
    cherry_studio: 'CherryStudio',
  }
  const icon = icons[props.family]
  return icon ? (
    <span className='flex shrink-0' aria-hidden>
      {getLobeIcon(icon, 18)}
    </span>
  ) : (
    <Monitor size={18} aria-hidden />
  )
}

export function ClientIdentity(props: { client?: ClientSnapshot }) {
  const { t } = useTranslation()
  const client = props.client
  if (!client) {
    return (
      <span className='text-muted-foreground text-xs'>{t('Not recorded')}</span>
    )
  }
  let category = client.display_name
  if (
    ['codex', 'claude_code', 'pi', 'opencode', 'zcode', 'dsh'].includes(
      client.family
    )
  ) {
    category = t('Coding client')
  }
  if (client.family === 'newapi') category = t('API gateway')
  if (client.family === 'unknown') category = t('Unknown client')
  let confidenceLabel = t('Unknown client')
  if (client.confidence === 'inferred') confidenceLabel = t('Inferred client')
  if (client.confidence === 'identified') {
    confidenceLabel = t('Recognized identifier')
  }
  const name =
    client.family === 'unknown' ? t('Unknown client') : client.display_name
  return (
    <Popover>
      <PopoverTrigger
        aria-label={name}
        className={cn(
          'flex min-h-10 w-full min-w-0 items-center gap-2 rounded-[4px] bg-linear-to-r to-transparent px-1.5 py-1 text-left text-lg focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-11',
          gradients[client.family]
        )}
      >
        <ClientIcon family={client.family} />
        <span className='truncate'>{name}</span>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='dark:bg-popover max-h-[calc(100dvh-24px)] w-[520px] max-w-[calc(100vw-24px)] gap-4 overflow-y-auto rounded-none border bg-[#faf9f7] p-5 text-base shadow-md'
      >
        <div>
          <PopoverTitle className='flex items-center gap-2 text-lg'>
            <ClientIcon family={client.family} />
            {name}
          </PopoverTitle>
          <PopoverDescription className='mt-1'>
            {t(
              'Identified from the original request before upstream header changes. Client identification is not official authentication.'
            )}
          </PopoverDescription>
        </div>
        <dl className='grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5'>
          <dt className='text-muted-foreground'>{t('Client family')}</dt>
          <dd>{category}</dd>
          <dt className='text-muted-foreground'>{t('Variant')}</dt>
          <dd>{client.variant || '—'}</dd>
          <dt className='text-muted-foreground'>{t('Version')}</dt>
          <dd>{client.version || '—'}</dd>
          <dt className='text-muted-foreground'>
            {t('Identification source')}
          </dt>
          <dd>User-Agent</dd>
          <dt className='text-muted-foreground'>
            {t('Identification status')}
          </dt>
          <dd>{confidenceLabel}</dd>
        </dl>
        {client.confidence === 'inferred' && (
          <p className='text-muted-foreground'>
            {t(
              'Generic Go UA inference: labeled NewAPI by site convention. Other Go programs may send the same identifier.'
            )}
          </p>
        )}
        <div className='border-border border-t pt-3'>
          <div className='mb-2 flex items-center justify-between'>
            <span>{t('Original User-Agent')}</span>
            <CopyButton
              value={client.user_agent}
              aria-label={t('Copy User-Agent')}
            />
          </div>
          <pre className='bg-muted/50 max-h-48 overflow-auto p-3 font-mono text-sm leading-6 wrap-anywhere whitespace-pre-wrap'>
            {client.user_agent || '—'}
          </pre>
          {client.truncated && (
            <p className='mt-2 text-amber-700 dark:text-amber-400'>
              {t('User-Agent truncated to 2048 bytes')}
            </p>
          )}
          <p className='text-muted-foreground mt-3'>
            {t(
              'This is the User-Agent received by this gateway. An earlier proxy may have changed it.'
            )}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
