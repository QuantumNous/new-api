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
import { Check, Copy } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useGuideAddress } from '@/features/guide/use-guide-address'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  formatPerMillionTokens,
  type SavingsModel,
} from '../../lib/pricing-savings'

interface ConnectProps {
  models: SavingsModel[]
}

const MARQUEE_ICONS = [
  'OpenAI',
  'Claude.Color',
  'Gemini.Color',
  'Meta.Color',
  'DeepSeek.Color',
  'Qwen.Color',
  'Kimi.Color',
  'Zhipu.Color',
]

export function Connect(props: ConnectProps) {
  const { t } = useTranslation()
  const address = useGuideAddress()
  const clipboard = useCopyToClipboard()
  const featured = useMemo(() => {
    return [...props.models].sort(
      (left, right) => right.savingsPercent - left.savingsPercent
    )[0]
  }, [props.models])
  const copied = clipboard.copiedText === address.baseUrl
  const marquee = [
    ...MARQUEE_ICONS.map((icon) => ({ icon, lane: 'a' })),
    ...MARQUEE_ICONS.map((icon) => ({ icon, lane: 'b' })),
  ]

  return (
    <section className='px-4 py-16 sm:px-6 md:py-24'>
      <div className='mx-auto max-w-5xl'>
        <h2 className='ci-display text-[clamp(2.2rem,5vw,4.2rem)] text-[var(--ci-ink)]'>
          {t('Change two values. Access every leading provider.')}
        </h2>
        <p className='text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed'>
          {t(
            'Replace your base URL and API key. Keep your messages, tools, streaming, and response handling exactly where they are.'
          )}
        </p>

        <div className='mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]'>
          <div className='rounded-2xl border bg-[var(--ci-surface)] p-5'>
            <div className='flex items-center justify-between gap-3'>
              <p className='text-sm font-medium'>{t('Base URL')}</p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => {
                  void clipboard.copyToClipboard(address.baseUrl)
                }}
              >
                {copied ? (
                  <Check className='size-3.5' />
                ) : (
                  <Copy className='size-3.5' />
                )}
                {copied ? t('Copied') : t('Copy')}
              </Button>
            </div>
            <code className='ci-mono bg-muted mt-3 block overflow-x-auto rounded-lg px-3 py-2 text-sm'>
              {address.baseUrl}
            </code>
            <pre className='ci-mono text-muted-foreground mt-5 overflow-x-auto text-xs leading-6'>
              {`// ${t('Live configuration update')}

baseURL: "${address.baseUrl}"
apiKey: "sk-..."`}
            </pre>
          </div>

          <aside className='rounded-2xl border bg-[var(--ci-surface)] p-5'>
            <p className='text-muted-foreground text-xs tracking-wide uppercase'>
              {t('Live rate comparison')}
            </p>
            {featured ? (
              <>
                <p className='mt-2 text-sm'>
                  {t('Output / 1M tokens for {{model}}', {
                    model: featured.modelName,
                  })}
                </p>
                <div className='mt-5 space-y-3'>
                  <div className='flex items-end justify-between gap-3'>
                    <span>{t('This site')}</span>
                    <span className='text-lg font-semibold'>
                      {formatPerMillionTokens(featured.siteOutputPrice)}
                    </span>
                  </div>
                  <div className='text-muted-foreground flex items-end justify-between gap-3'>
                    <span>{t('Base price')}</span>
                    <span className='line-through'>
                      {formatPerMillionTokens(featured.baseOutputPrice)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className='text-muted-foreground mt-4 text-sm'>
                {t('Prices update from the live model catalog.')}
              </p>
            )}
          </aside>
        </div>

        <div className='mt-10 overflow-hidden'>
          <div className='ci-marquee flex w-max items-center gap-10'>
            {marquee.map((item) => (
              <span
                key={`${item.lane}-${item.icon}`}
                className='flex size-10 items-center justify-center opacity-80'
              >
                {getLobeIcon(item.icon, 32)}
              </span>
            ))}
          </div>
        </div>

        <ul className='text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm'>
          <li>{t('OpenAI SDK compatible')}</li>
          <li>{t('Model selected per request')}</li>
          <li>{t('Every request visible in History')}</li>
        </ul>
      </div>
    </section>
  )
}
