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
import type { ComponentProps } from 'react'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function MaskedValueTrigger(props: ComponentProps<typeof Button>) {
  return (
    <Button
      variant='ghost'
      size='sm'
      {...props}
      className={cn(
        'text-muted-foreground h-7 max-w-full min-w-0 justify-start truncate px-0 font-mono text-xs hover:bg-transparent aria-expanded:bg-transparent',
        props.className
      )}
    />
  )
}

interface MaskedValueDisplayProps {
  /* * Title in the pop-up layer, such as "Full API Key" / "Full Code" */
  label: string
  /* * Full value, fully displayed in Popover */
  fullValue: string
  /* * Desensitization values shown in the table */
  maskedValue: string
  /* * Copy button tooltip */
  copyTooltip: string
  /* * Copy button's aria-label */
  copyAriaLabel: string
}

/* *
 * Used to display the desensitization key/redemption code in the table: click to display the complete content (the text block is fully displayed, not Input), and supports one-click copying. */
export function MaskedValueDisplay(props: MaskedValueDisplayProps) {
  return (
    <div className='flex max-w-full min-w-0 items-center'>
      <Popover>
        <PopoverTrigger render={<MaskedValueTrigger />}>
          <span className='truncate'>{props.maskedValue}</span>
        </PopoverTrigger>
        <PopoverContent
          className='w-auto max-w-[min(90vw,28rem)]'
          align='start'
        >
          <div className='space-y-2'>
            <p className='text-muted-foreground text-xs'>{props.label}</p>
            <pre
              className='bg-muted/50 max-h-[50vh] overflow-auto rounded-md border px-3 py-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap'
              style={{ wordBreak: 'break-all' }}
            >
              {props.fullValue}
            </pre>
          </div>
        </PopoverContent>
      </Popover>
      <CopyButton
        value={props.fullValue}
        className='size-7'
        iconClassName='size-3.5'
        tooltip={props.copyTooltip}
        aria-label={props.copyAriaLabel}
      />
    </div>
  )
}
