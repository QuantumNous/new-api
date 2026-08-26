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
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Claude, Doubao, Gemini, Grok, Minimax, OpenAI } from '@lobehub/icons'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { isNewAccount } from './new-account'
import {
  hasSeenWelcomeNotice,
  markWelcomeNoticeSeen,
} from './welcome-notice-persistence'

type ModelLogo = ComponentType<{
  'aria-hidden'?: boolean
  className?: string
  size?: number
}>

const featuredModels: Array<{ label: string; logo: ModelLogo }> = [
  { label: 'Seedance', logo: Doubao.Color },
  { label: 'GPT', logo: OpenAI },
  { label: 'Claude', logo: Claude.Color },
  { label: 'Gemini', logo: Gemini.Color },
  { label: 'Grok', logo: Grok },
  { label: 'MiniMax', logo: Minimax.Color },
]

export function OverviewHero() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const userId = user?.id ?? null

  // The greeting belongs to a brand-new account's first visit only: a used
  // account never sees it, and a new one sees it exactly once.
  const [showNotice, setShowNotice] = useState(
    () => isNewAccount(user) && !hasSeenWelcomeNotice(userId)
  )

  // Rendering is what counts as "shown" — a user who reads the banner and
  // navigates away without clicking Dismiss has still seen it.
  useEffect(() => {
    if (!showNotice) return
    markWelcomeNoticeSeen(userId)
  }, [showNotice, userId])

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <span className='text-primary text-xs font-bold tracking-[0.1em] uppercase'>
          {t('Your AI gateway')}
        </span>
        <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
          {t('Build with any model, your way.')}
        </h1>
        <p className='text-muted-foreground flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-2 text-base'>
          <span>{t('One key connects you to the models shaping AI:')}</span>
          <span className='inline-flex flex-wrap items-center gap-x-3 gap-y-2'>
            {featuredModels.map((model, index) => {
              const Logo = model.logo
              return (
                <span
                  className='inline-flex items-center gap-x-3'
                  key={model.label}
                >
                  {index > 0 && (
                    <span aria-hidden className='text-muted-foreground/60'>
                      ·
                    </span>
                  )}
                  <span className='text-foreground inline-flex items-center gap-1.5 font-medium'>
                    <Logo aria-hidden className='size-4 shrink-0' size={16} />
                    {model.label}
                  </span>
                </span>
              )
            })}
          </span>
        </p>
      </div>

      {showNotice && (
        <div className='bg-primary/5 border-primary/20 flex items-start gap-3 rounded-xl border p-4'>
          <div className='flex-1'>
            <div className='font-semibold'>{t('Welcome to Flatkey')}</div>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t(
                'Your account is ready. Add an API key, then choose the integration that fits your workflow.'
              )}
            </p>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setShowNotice(false)}
            aria-label={t('Dismiss')}
          >
            <X data-icon='inline-start' />
            {t('Dismiss')}
          </Button>
        </div>
      )}
    </div>
  )
}
