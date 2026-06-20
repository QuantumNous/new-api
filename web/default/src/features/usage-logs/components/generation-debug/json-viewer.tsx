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
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import type { GenerationDebugRawValue } from './types'
import { stringifyDebugValue } from './utils'

interface JsonViewerProps {
  label?: string
  value: unknown
  rawMeta?: GenerationDebugRawValue
  className?: string
  maxHeightClassName?: string
}

export function JsonViewer(props: JsonViewerProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const content = stringifyDebugValue(props.value)

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', props.className)}>
      <div className='flex min-w-0 items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          {props.label && (
            <span className='truncate text-xs font-medium'>{props.label}</span>
          )}
          <Badge variant='secondary'>JSON</Badge>
          {props.rawMeta?.truncated && (
            <Badge variant='destructive'>{t('Truncated')}</Badge>
          )}
          {props.rawMeta && (
            <span className='text-muted-foreground text-[11px]'>
              {props.rawMeta.captured_bytes.toLocaleString()} {t('bytes')}
            </span>
          )}
        </div>
        <Button
          variant='outline'
          size='xs'
          onClick={() => copyToClipboard(content)}
          aria-label={t('Copy to clipboard')}
        >
          {copiedText === content ? (
            <CheckIcon data-icon='inline-start' />
          ) : (
            <CopyIcon data-icon='inline-start' />
          )}
          {t('Copy')}
        </Button>
      </div>
      <ScrollArea
        className={cn(
          'bg-muted/30 h-[min(55dvh,560px)] min-w-0 rounded-md border',
          props.maxHeightClassName
        )}
      >
        <pre className='min-w-max p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap'>
          {content}
        </pre>
      </ScrollArea>
    </div>
  )
}
