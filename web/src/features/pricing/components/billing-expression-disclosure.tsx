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
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

/** Keep diagnostic formulas available without presenting code as a price. */
export function BillingExpressionDisclosure(props: { expression: string }) {
  const { t } = useTranslation()
  return (
    <Collapsible key={props.expression} className='mt-3 min-w-0'>
      <CollapsibleTrigger className='group text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs'>
        <ChevronRight
          aria-hidden='true'
          className='size-3.5 shrink-0 transition-transform group-data-[panel-open]:rotate-90'
        />
        {t('Raw expression')}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <code className='text-muted-foreground bg-background/80 mt-2 block max-h-40 overflow-auto rounded-md border px-2 py-1.5 font-mono text-xs break-all'>
          {props.expression}
        </code>
      </CollapsibleContent>
    </Collapsible>
  )
}
