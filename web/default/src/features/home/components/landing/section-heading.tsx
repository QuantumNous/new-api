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
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
  centered?: boolean
}

export function SectionHeading(props: SectionHeadingProps) {
  if (props.centered) {
    return (
      <header className='mx-auto mb-10 max-w-3xl text-center sm:mb-12'>
        <p className='text-primary mb-3 text-xs font-semibold uppercase'>
          {props.eyebrow}
        </p>
        <h2 className='text-foreground text-3xl leading-tight font-semibold sm:text-4xl'>
          {props.title}
        </h2>
        {props.description && (
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-sm leading-7 sm:text-base'>
            {props.description}
          </p>
        )}
      </header>
    )
  }

  return (
    <header
      className={cn(
        'grid items-end gap-5',
        props.description
          ? 'mb-10 sm:mb-12 md:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'
          : 'mb-8 sm:mb-10'
      )}
    >
      <div>
        <p className='text-primary mb-3 text-xs font-semibold uppercase'>
          {props.eyebrow}
        </p>
        <h2 className='text-foreground max-w-3xl text-3xl leading-tight font-semibold sm:text-4xl'>
          {props.title}
        </h2>
      </div>
      {props.description && (
        <p className='text-muted-foreground text-sm leading-7 sm:text-base'>
          {props.description}
        </p>
      )}
    </header>
  )
}
