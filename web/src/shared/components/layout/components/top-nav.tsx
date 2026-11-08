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
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { cn } from '@/shared/lib/utils'

import type { TopNavLink } from '../types'

type TopNavProps = React.HTMLAttributes<HTMLElement> & {
  links: TopNavLink[]
}

const LINK_CLASS =
  'focus-visible:ring-ring/40 min-w-0 truncate rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none'

/**
 * Inline top navigation.
 *
 * Visible from the `lg` breakpoint up. Below `lg` the links are not rendered
 * here at all; they are injected into the main sidebar instead, so there is no
 * second navigation drawer to open.
 */
export function TopNav({ className, links, ...props }: TopNavProps) {
  const normalizedLinks = useMemo(
    () =>
      links.map((link) => ({
        isActive: false,
        disabled: false,
        external: false,
        ...link,
      })),
    [links]
  )

  return (
    <nav
      className={cn('hidden min-w-0 items-center gap-0.5 lg:flex', className)}
      {...props}
    >
      {normalizedLinks.map(
        ({ title, href, isActive, disabled, external }) => {
          const linkClassName = cn(
            LINK_CLASS,
            isActive
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'pointer-events-none opacity-50'
          )

          if (external) {
            return (
              <a
                key={`${title}:${href}`}
                href={href}
                title={title}
                target='_blank'
                rel='noopener noreferrer'
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : undefined}
                className={linkClassName}
              >
                {title}
              </a>
            )
          }

          return (
            <Link
              key={`${title}:${href}`}
              to={href}
              title={title}
              disabled={disabled}
              className={linkClassName}
            >
              {title}
            </Link>
          )
        }
      )}
    </nav>
  )
}
