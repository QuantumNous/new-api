/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { DateRangePreset } from '../types'

const PRESETS: { id: DateRangePreset; labelKey: string }[] = [
  { id: '24h', labelKey: 'Last 24 hours' },
  { id: '7d', labelKey: 'Last 7 days' },
  { id: '30d', labelKey: 'Last 30 days' },
]

interface DateRangeControlProps {
  value: DateRangePreset
  onChange: (preset: DateRangePreset) => void
}

export function DateRangeControl({ value, onChange }: DateRangeControlProps) {
  const { t } = useTranslation()

  return (
    <div className='flex items-center gap-1'>
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          size='sm'
          variant={value === p.id ? 'default' : 'outline'}
          onClick={() => onChange(p.id)}
          className='h-7 px-3 text-xs'
        >
          {t(p.labelKey)}
        </Button>
      ))}
      {/* Custom range — P1: disabled placeholder */}
      <Button
        size='sm'
        variant='outline'
        disabled
        className='h-7 px-3 text-xs opacity-40'
        title={t('Custom range coming soon')}
      >
        {t('Custom range')}
      </Button>
    </div>
  )
}
