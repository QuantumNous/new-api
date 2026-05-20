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
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSubscriptions } from './subscriptions-provider'

export function SubscriptionsPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, complianceConfirmed } = useSubscriptions()

  const createButtonClassName = cn(
    'shadow-sm text-primary-foreground [&_svg]:text-primary-foreground',
    'disabled:pointer-events-none disabled:cursor-not-allowed',
    /* Disabled: readable on dark surfaces without looking “broken” */
    'disabled:!opacity-90 disabled:border disabled:border-white/15 disabled:bg-white/10 disabled:text-slate-200 disabled:shadow-none',
    'disabled:[&_svg]:text-slate-200'
  )

  const createButton = (
    <Button
      size='sm'
      onClick={() => setOpen('create')}
      disabled={!complianceConfirmed}
      className={createButtonClassName}
    >
      <Plus className='h-4 w-4' />
      {t('subs.action.create_plan')}
    </Button>
  )

  return (
    <div className='flex gap-2'>
      {complianceConfirmed ? (
        createButton
      ) : (
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger
              render={<span className='inline-flex cursor-default rounded-lg' />}
            >
              {createButton}
            </TooltipTrigger>
            <TooltipContent side='bottom' className='max-w-xs text-balance'>
              <p>{t('subs.action.create_plan_disabled_reason')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
