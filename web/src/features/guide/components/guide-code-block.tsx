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
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { fillGuideTemplate } from '../lib/runtime'
import type { GuideCode, GuideRuntime } from '../types'

type GuideCodeBlockProps = {
  code: GuideCode
  runtime: GuideRuntime
}

export function GuideCodeBlock(props: GuideCodeBlockProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const resolved = fillGuideTemplate(props.code.template, props.runtime)
  const copyLabel = t(props.code.copyLabel ?? 'Copy code')
  const copied = copiedText === resolved
  const requiresVerifiedSelection = /\{\{(?:MODEL|GROUP)\}\}/.test(
    props.code.template
  )
  const copyDisabled = requiresVerifiedSelection && !props.runtime.verified

  return (
    <figure className='border-border bg-card my-4 min-w-0 overflow-hidden rounded-2xl border'>
      <figcaption className='border-border flex min-h-10 items-center gap-2 border-b px-3 py-2'>
        <span className='min-w-0 flex-1 truncate text-xs font-medium'>
          {t(props.code.label)}
        </span>
        <Badge variant='secondary'>{props.code.language}</Badge>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-label={copyLabel}
          disabled={copyDisabled}
          onClick={() => void copyToClipboard(resolved)}
        >
          <HugeiconsIcon
            icon={copied ? Tick02Icon : Copy01Icon}
            data-icon='inline-start'
            strokeWidth={2}
          />
          {copied ? t('Copied') : t('Copy')}
        </Button>
      </figcaption>
      <pre className='bg-muted text-foreground max-w-full overflow-x-auto p-4 text-xs leading-6'>
        <code>{resolved}</code>
      </pre>
      <span className='sr-only' aria-live='polite'>
        {copied ? t('Copied to clipboard') : ''}
      </span>
    </figure>
  )
}
