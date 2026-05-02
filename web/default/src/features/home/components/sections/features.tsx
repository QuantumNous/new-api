import {
  Film,
  ImagePlus,
  Layers,
  Volume2,
  Webhook,
  DollarSign,
  Key,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'models',
      num: '01',
      title: t('Multiple Models'),
      desc: t(
        'Seedance 2.0 today. Pixverse and HappyHorse on the roadmap — same API, no migration.'
      ),
      span: 'md:col-span-2',
      icon: <Sparkles className='size-4 text-blue-400' />,
      visual: (
        <div className='mt-4 grid grid-cols-2 gap-2'>
          {[
            { name: 'Seedance 2.0', status: 'live' },
            { name: 'Seedance 2.0 fast', status: 'live' },
            { name: 'Pixverse v5.5', status: 'soon' },
            { name: 'HappyHorse', status: 'soon' },
          ].map((m) => (
            <div
              key={m.name}
              className='border-border/30 bg-muted/20 flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors duration-300 hover:border-blue-500/30 hover:bg-blue-500/5'
            >
              <span className='text-muted-foreground'>{m.name}</span>
              <span
                className={
                  m.status === 'live'
                    ? 'rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400'
                    : 'rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400'
                }
              >
                {m.status === 'live' ? 'LIVE' : 'SOON'}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'multimodal',
      num: '02',
      title: t('Multimodal Input'),
      desc: t(
        'Text, reference images (1–9), input video, and audio — combined in one request.'
      ),
      span: 'md:col-span-1',
      icon: <ImagePlus className='size-4 text-emerald-400' />,
      visual: (
        <div className='mt-4 flex items-center justify-center gap-1.5'>
          {['text', 'image', 'video', 'audio'].map((m) => (
            <div
              key={m}
              className='border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 rounded border px-2 py-1 text-[10px] font-medium'
            >
              {m}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'frame-control',
      num: '03',
      title: t('First/Last Frame Control'),
      desc: t(
        'Pin both ends of a video with reference images. Useful for transitions, intros, brand sequences.'
      ),
      span: 'md:col-span-1',
      icon: <Layers className='size-4 text-violet-400' />,
      visual: (
        <div className='mt-4 flex items-center justify-center gap-2'>
          <div className='border-violet-500/30 bg-violet-500/10 flex size-10 items-center justify-center rounded border text-[10px] font-medium text-violet-700 dark:text-violet-400'>
            first
          </div>
          <div className='text-muted-foreground/40 text-[10px]'>→</div>
          <div className='border-border/40 bg-muted/20 flex size-10 items-center justify-center rounded border text-[10px]'>
            ···
          </div>
          <div className='text-muted-foreground/40 text-[10px]'>→</div>
          <div className='border-violet-500/30 bg-violet-500/10 flex size-10 items-center justify-center rounded border text-[10px] font-medium text-violet-700 dark:text-violet-400'>
            last
          </div>
        </div>
      ),
    },
    {
      id: 'audio',
      num: '04',
      title: t('Generate with Audio'),
      desc: t(
        'Built-in audio generation for Seedance 2.0. No separate TTS step.'
      ),
      span: 'md:col-span-2',
      icon: <Volume2 className='size-4 text-amber-400' />,
      visual: (
        <div className='mt-4 flex items-center gap-2'>
          {[3, 7, 10, 5, 8, 11, 4, 9, 6, 12, 5, 8].map((h, i) => (
            <div
              key={i}
              className='from-amber-500/40 to-amber-500/10 w-1.5 rounded-full bg-gradient-to-t'
              style={{ height: `${h * 2.5}px` }}
            />
          ))}
          <div className='text-muted-foreground ml-2 flex items-center gap-1.5 text-xs'>
            <Volume2 className='size-3.5 text-amber-500' />
            {t('Native audio track')}
          </div>
        </div>
      ),
    },
  ]

  const additionalFeatures = [
    {
      icon: <Film className='size-5' strokeWidth={1.5} />,
      title: t('Async + Webhook'),
      desc: t('Submit, get task_id, poll or wait for callback. No blocking.'),
    },
    {
      icon: <DollarSign className='size-5' strokeWidth={1.5} />,
      title: t('Per-Video Billing'),
      desc: t('Charged only on success. No tokens, no minimums, no surprises.'),
    },
    {
      icon: <Key className='size-5' strokeWidth={1.5} />,
      title: t('OpenAI-Style Auth'),
      desc: t('Bearer sk-... — drop into any OpenAI-compatible HTTP client.'),
    },
    {
      icon: <Webhook className='size-5' strokeWidth={1.5} />,
      title: t('24h Proxy Cache'),
      desc: t('Generated mp4 served through our domain — hide signed URLs.'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Core Features')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Production-grade video gen,')}
            <br />
            {t('one HTTP call away')}
          </h2>
        </AnimateInView>

        {/* Bento grid */}
        <div className='border-border/40 bg-border/40 grid gap-px overflow-hidden rounded-xl border md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 100}
              animation='scale-in'
              className={`bg-background group hover:bg-muted/20 p-7 transition-colors duration-300 md:p-8 ${f.span}`}
            >
              <div className='mb-3 flex items-center gap-3'>
                <span className='border-border/40 bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums'>
                  {f.num}
                </span>
                <h3 className='text-sm font-semibold'>{f.title}</h3>
              </div>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {f.desc}
              </p>
              {f.visual}
            </AnimateInView>
          ))}
        </div>

        {/* Additional features row */}
        <div className='mt-12 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12'>
          {additionalFeatures.map((f, i) => (
            <AnimateInView
              key={f.title}
              delay={i * 100}
              animation='fade-up'
              className='flex flex-col items-center text-center'
            >
              <div className='text-muted-foreground border-border/50 bg-muted/30 group-hover:text-foreground mb-3 flex size-12 items-center justify-center rounded-xl border transition-colors'>
                {f.icon}
              </div>
              <h3 className='mb-1.5 text-sm font-semibold'>{f.title}</h3>
              <p className='text-muted-foreground max-w-[200px] text-xs leading-relaxed'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
