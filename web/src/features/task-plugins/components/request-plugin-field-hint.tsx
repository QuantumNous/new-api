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
import { Info } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * A field's description behind an info icon, for list items and table
 * columns where a line under every field would crowd them.
 */
export function RequestPluginFieldHint(props: { text?: string }) {
  if (!props.text) return null
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type='button'
              aria-label={props.text}
              className='text-muted-foreground hover:text-foreground inline-flex rounded-sm'
            />
          }
        >
          <Info aria-hidden='true' className='size-3.5' />
        </TooltipTrigger>
        <TooltipContent className='max-w-64'>{props.text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
