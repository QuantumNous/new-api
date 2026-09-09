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
import { ChevronDown, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { useIsAdmin } from '@/hooks/use-admin'

export function AccessTokenPrompt(props: { token: string }) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const taskScope = isAdmin
    ? t(
        'Help me administer this new-api instance within my current permissions.'
      )
    : t(
        'Help me use this new-api instance within the permissions of my own account.'
      )
  const prompt = t(
    '{{taskScope}}\n\nSite URL: {{siteUrl}}\nAuthorization: Bearer {{accessToken}}\n\nSource navigation: {{skillUrl}}\nUse this guide to locate the relevant implementation in the official GitHub repository. Determine the current API, inputs, permissions and response from that code, then carry out my request. Only send the access token to the site above.\n\nMy request:',
    {
      taskScope,
      siteUrl: window.location.origin,
      accessToken: props.token,
      skillUrl: `https://raw.githubusercontent.com/QuantumNous/new-api/main/skills/new-api-${isAdmin ? 'admin' : 'user'}/SKILL.md`,
      nsSeparator: false,
      interpolation: { escapeValue: false },
    }
  )
  const copyLabel = t('Copy prompt with token')

  return (
    <Collapsible
      role='group'
      aria-label={t('Use with AI')}
      className='bg-muted/30 min-w-0 rounded-xl border p-3'
    >
      <div className='flex items-start gap-2.5'>
        <Sparkles
          className='text-primary mt-0.5 size-4 shrink-0'
          aria-hidden='true'
        />
        <div className='min-w-0 space-y-1'>
          <h5 className='text-sm font-medium'>{t('Use with AI')}</h5>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            {t(
              'Copy a prompt to your AI assistant, then describe what you want to do.'
            )}
          </p>
        </div>
      </div>
      <div className='mt-3 flex flex-wrap items-center justify-end gap-2'>
        <CollapsibleTrigger
          render={<Button variant='ghost' size='sm' className='group' />}
        >
          {t('Preview prompt')}
          <ChevronDown
            className='size-3.5 transition-transform group-aria-expanded:rotate-180'
            aria-hidden='true'
          />
        </CollapsibleTrigger>
        <CopyButton
          value={prompt}
          variant='outline'
          size='sm'
          aria-label={copyLabel}
        >
          {copyLabel}
        </CopyButton>
      </div>
      <CollapsibleContent>
        <Textarea
          aria-label={t('Prompt preview')}
          value={prompt}
          readOnly
          spellCheck={false}
          autoComplete='off'
          className='bg-background mt-3 h-64 max-h-[50vh] resize-none font-mono text-xs leading-relaxed md:text-xs'
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
