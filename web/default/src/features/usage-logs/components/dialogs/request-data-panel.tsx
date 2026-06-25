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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const SUMMARY_FIELDS: Array<{
  key: string
  labelKey: string
}> = [
  { key: 'prompt', labelKey: 'Prompt' },
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
  const [rawOpen, setRawOpen] = useState(false)

  const rawJson = useMemo(
    () => (data ? JSON.stringify(data, null, 2) : ''),
    [data]
  )

  const summaryItems = useMemo(() => {
    if (!data) return []
    return SUMMARY_FIELDS.flatMap(({ key, labelKey }) => {
      const value = formatSummaryValue(data[key])
      if (!value) return []
      return [{ key, label: t(labelKey), value }]
    })
  }, [data, t])

  if (!data || Object.keys(data).length === 0) return null

  return (
    <div className='space-y-3 rounded-lg border bg-muted/20 p-3'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm font-medium'>{t('Request Data')}</p>
        <CopyButton
          value={rawJson}
          variant='ghost'
          size='sm'
          className='h-7 px-2'
          iconClassName='size-3.5'
          tooltip={t('Copy to clipboard')}
        />
      </div>

      {summaryItems.length > 0 && (
        <dl className='grid gap-2 sm:grid-cols-2'>
          {summaryItems.map((item) => (
            <div
              key={item.key}
              className={cn(
                'space-y-0.5 rounded-md bg-background/80 px-2.5 py-2',
                item.key === 'prompt' && 'sm:col-span-2'
              )}
            >
              <dt className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>
                {item.label}
              </dt>
              <dd
                className={cn(
                  'text-sm leading-snug break-words',
                  item.key === 'prompt' && 'line-clamp-4'
                )}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
        <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 text-xs font-medium transition-colors'>
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 transition-transform',
              rawOpen && 'rotate-180'
            )}
          />
          {rawOpen ? t('Hide raw JSON') : t('Show raw JSON')}
        </CollapsibleTrigger>
        <CollapsibleContent className='pt-2'>
          <pre className='bg-muted max-h-40 overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words'>
            {rawJson}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
