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
  Code2,
  Image as ImageIcon,
  Languages,
  Lightbulb,
  PackageOpen,
  PenSquare,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { MarketplaceSkill } from '@/features/marketplace/types'

type Suggestion = {
  icon: LucideIcon
  /** Short tag shown in the chip. */
  labelKey: string
  /** Full prompt sent when clicked. */
  promptKey: string
}

/**
 * Click-to-send suggestion chips shown when the playground has no
 * messages yet. Lowers the "blank chat" barrier for casual users who
 * land here from the persona picker's default-route.
 *
 * Click sends the prompt directly (no input pre-fill) because that's
 * what casual users expect from "try one of these" UI in modern chat
 * apps (ChatGPT, Cursor, Claude.ai all do this). The prompt is short
 * enough that users can iterate from the response.
 */
const SUGGESTIONS: Suggestion[] = [
  {
    icon: Sparkles,
    labelKey: 'Say hello',
    promptKey: 'Hi! Introduce yourself in one sentence.',
  },
  {
    icon: PenSquare,
    labelKey: 'Write a tweet',
    promptKey:
      'Write a tweet announcing my new side project that helps people learn Python.',
  },
  {
    icon: Languages,
    labelKey: 'Translate',
    promptKey: 'Translate to Chinese: "The early bird gets the worm."',
  },
  {
    icon: Code2,
    labelKey: 'Write code',
    promptKey: 'Write a Python function that returns the nth Fibonacci number.',
  },
  {
    icon: ImageIcon,
    labelKey: 'Describe an image',
    promptKey: 'Describe a peaceful mountain lake at sunrise in two sentences.',
  },
  {
    icon: Lightbulb,
    labelKey: 'Brainstorm',
    promptKey:
      'Brainstorm 5 weekend hobby ideas for someone who works at a computer all week.',
  },
]

type PlaygroundEmptyStateProps = {
  recommendedSkill?: MarketplaceSkill | null
  onDownloadRecommendation?: (skill: MarketplaceSkill) => void
  onSubmitPrompt: (prompt: string) => void
}

export function PlaygroundEmptyState({
  recommendedSkill,
  onDownloadRecommendation,
  onSubmitPrompt,
}: PlaygroundEmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className='flex h-full flex-col items-center justify-center gap-6 px-4 py-8'>
      <div className='space-y-1 text-center'>
        <h2 className='text-xl font-semibold tracking-tight sm:text-2xl'>
          {t('What can I help you with?')}
        </h2>
        <p className='text-muted-foreground text-sm'>
          {t('Pick a suggestion or type your own question.')}
        </p>
      </div>
      {recommendedSkill != null && (
        <div className='bg-card border-border flex w-full max-w-2xl flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex min-w-0 items-start gap-3'>
            <span className='bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg border border-current/10'>
              <PackageOpen className='size-4' aria-hidden='true' />
            </span>
            <div className='min-w-0'>
              <p className='text-sm font-semibold'>{t('Recommended skill')}</p>
              <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed'>
                {t('Try {{name}} for guided {{category}} work.', {
                  name: recommendedSkill.name,
                  category: recommendedSkill.category || t('everyday'),
                })}
              </p>
            </div>
          </div>
          <Button
            size='sm'
            onClick={() => onDownloadRecommendation?.(recommendedSkill)}
          >
            {t('Try skill')}
          </Button>
        </div>
      )}
      <div className='grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3'>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            type='button'
            onClick={() => onSubmitPrompt(t(s.promptKey))}
            className={cn(
              'group border-border bg-background hover:border-foreground/40 flex items-start gap-2 rounded-lg border p-3 text-left text-xs transition-all hover:shadow-sm',
              'focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] focus-visible:outline-none'
            )}
          >
            <s.icon className='text-muted-foreground group-hover:text-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
            <span className='min-w-0'>
              <span className='block text-xs font-medium'>{t(s.labelKey)}</span>
              <span className='text-muted-foreground/80 line-clamp-2 block text-[11px] leading-snug'>
                {t(s.promptKey)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
