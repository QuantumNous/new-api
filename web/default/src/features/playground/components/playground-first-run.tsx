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
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

// Example prompts shown as one-click chips during the first run. They fill the
// input and send immediately so a brand-new user can make their first API call
// with zero typing. Keys are translated via t().
const FIRST_RUN_EXAMPLE_PROMPTS = [
  'Hello!',
  'Write a quicksort in Python',
  'Explain Transformers',
] as const

interface FirstRunWelcomeProps {
  onPickExample: (prompt: string) => void
  disabled?: boolean
}

/**
 * Welcome banner + example-prompt chips shown at the top of the empty Playground
 * when a user lands via `?first=1` and has not sent any message yet.
 */
export function FirstRunWelcome({
  onPickExample,
  disabled = false,
}: FirstRunWelcomeProps) {
  const { t } = useTranslation()
  return (
    <div className='mx-auto w-full max-w-4xl px-4 pt-6'>
      <div className='rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 dark:border-violet-900/40 dark:from-violet-950/30 dark:to-transparent'>
        <div className='flex items-start gap-3'>
          <span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white'>
            <Sparkles className='size-4' />
          </span>
          <p className='text-foreground text-sm leading-relaxed'>
            {t(
              'Welcome to flatkey! Send a message to make your first API call in 30 seconds — no key or setup needed.'
            )}
          </p>
        </div>
        <div className='mt-4 flex flex-wrap gap-2'>
          {FIRST_RUN_EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type='button'
              disabled={disabled}
              onClick={() => onPickExample(prompt)}
              className='rounded-full border border-violet-200 bg-white px-3 py-1.5 text-sm text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-900/40 dark:bg-transparent dark:text-violet-300 dark:hover:bg-violet-950/30'
            >
              {t(prompt)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface GetKeyCardProps {
  onDismiss: () => void
}

/**
 * "Nice — it works!" card that slides in after the first successful assistant
 * response, nudging the user to grab their API key. Shown once per session.
 */
export function GetKeyCard({ onDismiss }: GetKeyCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className='mx-auto w-full max-w-4xl px-4 pb-3'>
      <div className='relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-4 text-white shadow-[0_18px_44px_-22px_rgba(124,58,237,0.9)]'>
        <button
          type='button'
          onClick={onDismiss}
          aria-label={t('Dismiss')}
          className='absolute top-2 right-2 rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white'
        >
          <X className='size-4' />
        </button>
        <div className='flex flex-col gap-3 pr-6 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-2'>
            <Sparkles className='size-5 shrink-0' />
            <span className='text-sm font-medium'>
              {t('Nice — it works! Use it in your own code')}
            </span>
          </div>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => navigate({ to: '/quickstart' })}
              className='text-sm text-white/90 underline-offset-2 hover:underline'
            >
              {t('View quickstart')}
            </button>
            <Button
              size='sm'
              onClick={() =>
                navigate({
                  to: '/keys',
                  search: { create: 1 },
                })
              }
              className='gap-1 rounded-full bg-white text-violet-700 hover:bg-violet-50'
            >
              {t('Get my API key')}
              <ArrowRight className='size-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
