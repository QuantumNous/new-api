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
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const META_FIELDS: Array<{ key: string; labelKey: string }> = [
  { key: 'model', labelKey: 'Model' },
  { key: 'quality', labelKey: 'Quality' },
  { key: 'n', labelKey: 'Count' },
  { key: 'effective_resolution', labelKey: 'Resolution' },
  { key: 'actual_image_count', labelKey: 'Image count' },
]

function formatSummaryValue(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    const urls = value.filter(
      (item): item is string =>
        typeof item === 'string' && /^https?:\/\//.test(item)
    )
    if (urls.length > 0) return `${urls.length} URL${urls.length > 1 ? 's' : ''}`
    return JSON.stringify(value)
  }
  return JSON.stringify(value)
}

export function RequestDataPanel({
  data,
}: {
  data?: Record<string, unknown> | null
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)

  const rawJson = useMemo(
    () => (data ? JSON.stringify(data, null, 2) : ''),
    [data]
  )

  const prompt = useMemo(
    () => (data ? formatSummaryValue(data.prompt) : null),
    [data]
  )

  const metaItems = useMemo(() => {
    if (!data) return []
    return META_FIELDS.flatMap(({ key, labelKey }) => {
      const value = formatSummaryValue(data[key])
      if (!value) return []
      return [{ key, label: t(labelKey), value }]
    })
  }, [data, t])

  const previewLine = useMemo(() => {
    const parts = metaItems.map((item) => item.value)
    if (prompt) {
      const short =
        prompt.length > 48 ? `${prompt.slice(0, 48).trim()}…` : prompt
      parts.unshift(short)
    }
    return parts.join(' · ')
  }, [metaItems, prompt])

  if (!data || Object.keys(data).length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className='hover:bg-muted/50 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors'>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
        <span className='shrink-0 text-sm font-medium'>{t('Request Data')}</span>
        {!open && previewLine ? (
          <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
            {previewLine}
          </span>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent className='space-y-2 pt-2'>
        {prompt ? (
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-muted-foreground text-xs font-medium'>
                {t('Prompt')}
              </p>
              <CopyButton
                value={prompt}
                variant='ghost'
                size='icon-sm'
                tooltip={t('Copy to clipboard')}
              />
            </div>
            <div className='bg-muted/40 max-h-36 overflow-y-auto rounded-md border px-2.5 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap'>
              {prompt}
            </div>
          </div>
        ) : null}

        {metaItems.length > 0 ? (
          <div className='flex flex-wrap gap-1.5'>
            {metaItems.map((item) => (
              <Badge key={item.key} variant='secondary' className='font-normal'>
                <span className='text-muted-foreground mr-1'>{item.label}</span>
                {item.value}
              </Badge>
            ))}
          </div>
        ) : null}

        <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
          <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs'>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 transition-transform',
                rawOpen && 'rotate-180'
              )}
            />
            {rawOpen ? t('Hide raw JSON') : t('Show raw JSON')}
          </CollapsibleTrigger>
          <CollapsibleContent className='pt-1.5'>
            <div className='relative'>
              <CopyButton
                value={rawJson}
                variant='ghost'
                size='icon-sm'
                className='absolute top-1.5 right-1.5 z-10'
                tooltip={t('Copy to clipboard')}
              />
              <pre className='bg-muted max-h-32 overflow-auto rounded-md p-3 pr-10 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words'>
                {rawJson}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CollapsibleContent>
    </Collapsible>
  )
}
