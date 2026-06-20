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
import { Clapperboard, Film, Sparkles, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

const VIDEO_EXAMPLES = [
  {
    src: '/home-media/ai-video-product-demo.mp4',
    title: 'Product motion clip',
    desc: 'Generate short marketing videos from a text prompt.',
    model: 'Kling / Jimeng route',
  },
  {
    src: '/home-media/ai-video-scene-demo.mp4',
    title: 'Cinematic scene sample',
    desc: 'Create visual scenes for social posts, ads, and prototypes.',
    model: 'Text-to-video workflow',
  },
] as const

export function VideoExamples() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 overflow-hidden px-6 py-20 md:py-28'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-10 flex flex-col gap-5 md:mb-14 md:flex-row md:items-end md:justify-between'>
          <div>
            <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase'>
              {t('AI video generation')}
            </p>
            <h2 className='max-w-2xl text-3xl leading-tight font-bold tracking-normal md:text-5xl'>
              {t('Prompt in. Video out.')}
            </h2>
          </div>
          <p className='text-muted-foreground max-w-lg text-sm leading-relaxed md:text-base'>
            {t(
              'DeepRouter can route video generation requests too: product clips, cinematic scenes, social ads, and prototype visuals from one account.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 lg:grid-cols-2'>
          {VIDEO_EXAMPLES.map((example, index) => (
            <AnimateInView
              key={example.src}
              delay={index * 120}
              animation='scale-in'
              className='border-border bg-card/80 overflow-hidden rounded-2xl border shadow-[0_16px_44px_rgb(28_28_28/0.08)]'
            >
              <div className='bg-foreground relative aspect-video'>
                <video
                  className='h-full w-full object-cover'
                  src={example.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload='metadata'
                />
                <div className='from-foreground/70 pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t to-transparent' />
                <div className='bg-foreground/72 text-primary-foreground absolute top-4 left-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-[0_8px_24px_rgb(0_0_0/0.18)] backdrop-blur'>
                  <Sparkles className='text-accent size-3.5' />
                  {t('AI generated')}
                </div>
              </div>

              <div className='grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center'>
                <div>
                  <div className='mb-2 flex items-center gap-2'>
                    {index === 0 ? (
                      <Clapperboard className='text-accent size-4' />
                    ) : (
                      <Film className='text-success size-4' />
                    )}
                    <h3 className='text-base font-semibold'>
                      {t(example.title)}
                    </h3>
                  </div>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(example.desc)}
                  </p>
                </div>

                <div className='border-border bg-background/75 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap'>
                  <WandSparkles className='text-warning size-4' />
                  {t(example.model)}
                </div>
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
