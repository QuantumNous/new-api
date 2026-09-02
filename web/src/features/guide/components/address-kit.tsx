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
import { Check, Copy, KeyRound, Link2, Puzzle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import type { GuideAddress } from '../use-guide-address'

interface AddressKitProps {
  address: GuideAddress
}

/**
 * The "three essentials" every tool needs: base address, API key, model ID.
 * Addresses come from the live deployment config — never hardcoded.
 */
export function AddressKit({ address }: AddressKitProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard()

  const items = [
    {
      icon: Link2,
      hue: 'var(--chart-1)',
      title: t('Interface address'),
      subtitle: t('Fill this when a tool asks for Base URL / API address'),
      value: address.baseUrl,
      copyable: true,
      note: t(
        'Some tools want the address without /v1, or the full path ending in /chat/completions — every tool card below tells you which one.'
      ),
    },
    {
      icon: KeyRound,
      hue: 'var(--chart-2)',
      title: t('API key'),
      subtitle: t('A password that starts with sk-, created in the console'),
      value: 'sk-****************',
      copyable: false,
      note: t(
        'Create it in Console → API Keys, copy it right away and keep it secret.'
      ),
    },
    {
      icon: Puzzle,
      hue: 'var(--chart-3)',
      title: t('Model ID'),
      subtitle: t('The exact name of the model you want to talk to'),
      value: 'gemini-2.5-flash',
      copyable: false,
      note: t(
        'Copy the full ID from the Models page — a single wrong letter means "model not found".'
      ),
    },
  ]

  return (
    <div className='dopa-guide-address-flow grid gap-4 md:grid-cols-3'>
      {items.map((item, index) => {
        const Icon = item.icon
        const copied = copiedText === item.value
        return (
          <div
            key={item.title}
            className='dopa-guide-address-node dopa-lift border-border bg-card relative flex flex-col gap-3 rounded-3xl border p-5'
            data-step={index + 1}
          >
            <div className='flex items-center gap-3'>
              <span
                className='flex size-10 items-center justify-center rounded-2xl'
                style={{
                  backgroundColor: `color-mix(in oklab, ${item.hue} 14%, transparent)`,
                  color: item.hue,
                }}
              >
                <Icon className='size-5' />
              </span>
              <div className='min-w-0'>
                <p className='text-sm font-bold'>{item.title}</p>
                <p className='text-muted-foreground text-xs'>{item.subtitle}</p>
              </div>
            </div>
            <div className='border-border bg-muted/60 flex items-center gap-2 rounded-xl border px-3 py-2'>
              <code className='min-w-0 flex-1 truncate font-mono text-xs'>
                {item.value}
              </code>
              {item.copyable && (
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0'
                  aria-label={t('Copy {{label}}', { label: item.title })}
                  onClick={() => copyToClipboard(item.value)}
                >
                  {copied ? (
                    <Check
                      className='dopa-pop-in size-3.5'
                      style={{ color: 'var(--success)' }}
                    />
                  ) : (
                    <Copy className='size-3.5' />
                  )}
                </Button>
              )}
            </div>
            <p className='text-muted-foreground text-xs leading-relaxed'>
              {item.note}
            </p>
          </div>
        )
      })}
    </div>
  )
}
