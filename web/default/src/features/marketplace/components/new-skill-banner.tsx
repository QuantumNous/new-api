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
import { Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { MarketplaceSkill } from '../types'

export function NewSkillBanner({
  skill,
  onAction,
  onDismiss,
}: {
  skill: MarketplaceSkill
  onAction: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className='bg-card border-border flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex min-w-0 items-start gap-3'>
        <span className='bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg border border-current/10'>
          <Sparkles className='size-4' aria-hidden='true' />
        </span>
        <div className='min-w-0'>
          <p className='text-sm font-semibold'>{t('New skill available')}</p>
          <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed'>
            {t('{{name}} can help with {{category}} tasks.', {
              name: skill.name,
              category: skill.category || t('everyday'),
            })}
          </p>
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        <Button size='sm' onClick={onAction}>
          {t('Try skill')}
        </Button>
        <button
          type='button'
          onClick={onDismiss}
          aria-label={t('Dismiss')}
          className='text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors'
        >
          <X className='size-4' aria-hidden='true' />
        </button>
      </div>
    </div>
  )
}
