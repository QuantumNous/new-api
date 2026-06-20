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
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

type RegionKey = 'au' | 'cn' | 'hk' | 'sg' | 'us' | 'eu' | 'global'

const REGIONS: { value: RegionKey; label: string }[] = [
  { value: 'au', label: '🇦🇺  Australia' },
  { value: 'cn', label: '🇨🇳  Chinese mainland' },
  { value: 'hk', label: '🇭🇰  Hong Kong' },
  { value: 'sg', label: '🇸🇬  Singapore' },
  { value: 'us', label: '🇺🇸  United States' },
  { value: 'eu', label: '🇪🇺  Europe' },
  { value: 'global', label: '🌍  Other / Global' },
]

const MODELS = ['Claude', 'OpenAI GPT', 'Gemini', 'DeepSeek', 'Moonshot'] as const

const TASKS: { label: string; model: string }[] = [
  { label: 'Generate images', model: 'GPT-Image & Gemini' },
  { label: 'Build an assistant', model: 'Claude' },
  { label: 'Make a video', model: 'Kling & Jimeng' },
  { label: 'Write & edit', model: 'Claude' },
  { label: 'Write code', model: 'Claude' },
  { label: 'Translate', model: 'Gemini' },
  { label: 'Power my app', model: 'auto' },
]

interface HeroAccessWizardProps {
  className?: string
  /** fired the first time the visitor touches the wizard — lets the hero react (I3) */
  onInteract?: () => void
}

/**
 * Interactive hero card: pick your region + what you want, and see what you
 * can use and how smart routing handles it. Marketing only — no jargon, no
 * chat (onboarding-v2 §7.1 / §9). The "routing preview" is illustrative.
 */
export function HeroAccessWizard({
  className,
  onInteract,
}: HeroAccessWizardProps) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const [region, setRegion] = useState<RegionKey>('au')
  const [mode, setMode] = useState<'model' | 'task'>('model')
  const [picked, setPicked] = useState<number | null>(null)

  const regionMsg =
    region === 'cn'
      ? t(
          "OpenAI and Anthropic don't sell directly in mainland China. With DeepRouter you use Claude, GPT and Gemini — pay in CNY via WeChat or Alipay, fapiao available."
        )
      : t('One account for every model — top up and start using them right away.')

  let result: string | null = null
  if (picked !== null) {
    if (mode === 'model') {
      result = t(
        '{{brand}} works through DeepRouter — one account, top up in your currency, no overseas card needed.',
        { brand: MODELS[picked] }
      )
    } else {
      const task = TASKS[picked]
      result =
        task.model === 'auto'
          ? t(
              "You don't pick a model. DeepRouter chooses the right one for each request — and a cheaper one when that's enough."
            )
          : t(
              "We'll use {{brand}} for this — all through your one DeepRouter account, no separate sign-up.",
              { brand: task.model }
            )
    }
  }

  const items = mode === 'model' ? MODELS.map((m) => ({ label: m })) : TASKS

  return (
    <div
      className={cn(
        'border-border/80 bg-card/70 w-full rounded-2xl border p-5 text-left shadow-[0_10px_28px_rgb(28_28_28/0.06)] sm:p-6',
        className
      )}
    >
      {/* step 1 — region */}
      <WizardStep n={1} label={t('Where are you?')} />
      <NativeSelect
        className='mt-2 w-full'
        value={region}
        onChange={(e) => {
          setRegion(e.target.value as RegionKey)
          onInteract?.()
        }}
        aria-label={t('Where are you?')}
      >
        {REGIONS.map((r) => (
          <NativeSelectOption key={r.value} value={r.value}>
            {r.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
        {regionMsg}
      </p>

      <div className='bg-border/70 my-5 h-px w-full' />

      {/* step 2 — intent */}
      <WizardStep n={2} label={t('What do you want?')} />
      <div className='mt-2 flex gap-1.5'>
        <Button
          size='sm'
          variant={mode === 'model' ? 'default' : 'ghost'}
          onClick={() => {
            setMode('model')
            setPicked(null)
            onInteract?.()
          }}
        >
          {t('A model I know')}
        </Button>
        <Button
          size='sm'
          variant={mode === 'task' ? 'default' : 'ghost'}
          onClick={() => {
            setMode('task')
            setPicked(null)
            onInteract?.()
          }}
        >
          {t('Just get it done')}
        </Button>
      </div>
      <div className='mt-3 flex flex-wrap gap-2'>
        {items.map((item, i) => (
          <Button
            key={item.label}
            size='sm'
            variant={picked === i ? 'default' : 'outline'}
            onClick={() => {
              setPicked(i)
              onInteract?.()
            }}
          >
            {t(item.label)}
          </Button>
        ))}
      </div>
      <AnimatePresence mode='wait'>
        {result && (
          <motion.div
            key={result}
            initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className='border-border bg-muted/40 mt-3 flex gap-2 rounded-lg border px-3 py-2.5 text-sm leading-relaxed'
          >
            <Check className='text-accent mt-0.5 size-4 shrink-0' />
            <span>{result}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className='bg-border/70 my-5 h-px w-full' />

      {/* step 3 — cta */}
      <Button className='group w-full' render={<Link to='/sign-up' />}>
        {t('Get your key — ready in 2 minutes')}
        <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
      </Button>
    </div>
  )
}

function WizardStep({ n, label }: { n: number; label: string }) {
  return (
    <div className='flex items-center gap-2'>
      <span className='bg-accent/10 text-accent inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold'>
        {n}
      </span>
      <span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
        {label}
      </span>
    </div>
  )
}
