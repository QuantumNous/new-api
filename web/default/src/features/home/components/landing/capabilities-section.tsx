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
import {
  AudioLinesIcon,
  Image01Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import generatedInterfaceGridAvif from '@/assets/home/generated-interface-grid.avif'
import generatedInterfaceGridWebp from '@/assets/home/generated-interface-grid.webp'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

import { SectionHeading } from './section-heading'

const WAVE_BARS = [24, 52, 34, 78, 46, 92, 62, 36, 72, 44, 60].map(
  (height, position) => ({ id: `wave-${position + 1}`, height })
)

export function CapabilitiesSection() {
  const { t } = useTranslation()

  return (
    <section className='bg-muted/60 px-4 py-16 sm:px-6 sm:py-20 lg:py-24'>
      <div className='mx-auto w-full max-w-6xl'>
        <SectionHeading
          eyebrow={t('Multimodal')}
          title={t('More than text, one gateway for every model capability.')}
        />

        <Card className='grid gap-0 rounded-lg py-0 lg:grid-cols-[1.08fr_0.92fr]'>
          <section className='border-border p-5 sm:p-7 lg:border-e'>
            <div className='flex items-start gap-3'>
              <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
                <HugeiconsIcon icon={Image01Icon} className='size-5' />
              </div>
              <div>
                <p className='text-primary text-xs font-semibold uppercase'>
                  {t('Vision and image')}
                </p>
                <h3 className='mt-2 text-xl font-semibold sm:text-2xl'>
                  {t('Image understanding and generation')}
                </h3>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                  {t(
                    'Inspect requests, results, latency, and usage in one workflow.'
                  )}
                </p>
              </div>
            </div>

            <div className='border-border bg-muted/40 mt-6 grid min-h-64 overflow-hidden rounded-lg border sm:grid-cols-[0.72fr_1.28fr]'>
              <div className='border-border p-4 sm:border-e'>
                <p className='text-muted-foreground text-xs font-semibold uppercase'>
                  {t('Request')}
                </p>
                <pre className='text-muted-foreground mt-4 overflow-x-auto font-mono text-xs leading-6'>
                  {`model: "YOUR_IMAGE_MODEL"\nprompt: "Product interface..."\nsize: "1024x1024"`}
                </pre>
              </div>
              <div className='bg-primary/5 border-border border-t p-4 sm:border-t-0'>
                <p className='text-muted-foreground text-xs font-semibold uppercase'>
                  {t('Output')}
                </p>
                <picture
                  className='mt-4 block overflow-hidden rounded-lg'
                  aria-hidden='true'
                >
                  <source
                    srcSet={generatedInterfaceGridAvif}
                    type='image/avif'
                  />
                  <img
                    src={generatedInterfaceGridWebp}
                    alt=''
                    width={1012}
                    height={812}
                    loading='lazy'
                    decoding='async'
                    fetchPriority='low'
                    className='aspect-[253/203] h-auto w-full object-cover'
                  />
                </picture>
              </div>
            </div>
          </section>

          <div className='grid grid-rows-2'>
            <section className='border-border p-5 sm:p-7 lg:border-b'>
              <div className='flex items-start gap-3'>
                <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
                  <HugeiconsIcon icon={AudioLinesIcon} className='size-5' />
                </div>
                <div>
                  <p className='text-primary text-xs font-semibold uppercase'>
                    {t('Audio')}
                  </p>
                  <h3 className='mt-2 text-xl font-semibold'>
                    {t('Speech processing')}
                  </h3>
                  <p className='text-muted-foreground mt-2 text-sm leading-6'>
                    {t(
                      'Manage transcription, synthesis, and audio model requests.'
                    )}
                  </p>
                </div>
              </div>
              <div
                className='mt-6 flex h-16 items-center gap-1.5'
                aria-hidden='true'
              >
                {WAVE_BARS.map((bar) => (
                  <span
                    key={bar.id}
                    className='bg-primary block w-1.5 rounded-full opacity-75'
                    style={{ height: `${bar.height}%` }}
                  />
                ))}
              </div>
            </section>

            <section className='border-border border-t p-5 sm:p-7 lg:border-t-0'>
              <div className='flex items-start gap-3'>
                <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
                  <HugeiconsIcon icon={Video01Icon} className='size-5' />
                </div>
                <div>
                  <p className='text-primary text-xs font-semibold uppercase'>
                    {t('Video')}
                  </p>
                  <h3 className='mt-2 text-xl font-semibold'>
                    {t('Video and asynchronous tasks')}
                  </h3>
                  <p className='text-muted-foreground mt-2 text-sm leading-6'>
                    {t(
                      'Track long-running task status without spreading polling logic across your product.'
                    )}
                  </p>
                </div>
              </div>
              <div className='mt-6 flex flex-wrap gap-2'>
                {[
                  t('Queued'),
                  t('Running'),
                  t('Processing'),
                  t('Completed'),
                ].map((status) => (
                  <Badge key={status} variant='outline'>
                    {status}
                  </Badge>
                ))}
              </div>
            </section>
          </div>
        </Card>
      </div>
    </section>
  )
}
