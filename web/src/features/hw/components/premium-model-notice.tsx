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
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

import { premiumNotice } from '../data/model-guide'
import type { ModelPrice } from '../data/model-prices'

type PremiumModelNoticeProps = {
  model: string | undefined
  /** Language of the text; defaults to the interface language. */
  language?: string
  models?: readonly ModelPrice[]
  /** Show the model name as a title, for a list that names several models. */
  showModel?: boolean
  className?: string
}

/**
 * Small notice on a premium model: it uses up credit much faster, and the
 * model one step lower is much cheaper. Renders nothing for other models.
 */
export function PremiumModelNotice(props: PremiumModelNoticeProps) {
  const { i18n } = useTranslation()
  const text = premiumNotice(
    props.model,
    props.language ?? i18n.resolvedLanguage ?? i18n.language,
    props.models
  )
  if (!text) return null
  return (
    <Alert
      className={cn('border-amber-500/40 bg-amber-500/5', props.className)}
      data-testid='hw-premium-notice'
      role='note'
    >
      {props.showModel && (
        <AlertTitle className='font-mono text-xs'>{props.model}</AlertTitle>
      )}
      <AlertDescription className='text-foreground text-xs'>
        {text}
      </AlertDescription>
    </Alert>
  )
}
