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
import { Menu } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import type { TopNavLink } from '../types'

type TopNavProps = React.HTMLAttributes<HTMLElement> & {
  links: TopNavLink[]
}

const HORIZONTAL_LINK_CLASS =
  'focus-visible:ring-ring/40 min-w-0 truncate rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none'

const DRAWER_LINK_CLASS =
  'focus-visible:ring-ring/40 flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none'

/**
 * Top navigation.
 *
 * From the `lg` breakpoint up, links render inline in the header and can shrink
 * with an ellipsis instead of overlapping their neighbours. Below `lg` — phones
 * and portrait tablets — the links move into a slide-in drawer opened from the
 * hamburger button. The drawer takes the start edge of the page, so it opens
 * from the right in RTL layouts.
 */
export function TopNav({ className, links, ...props }: TopNavProps) {
  const { t } = useTranslation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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

  const closeDrawer = () => setIsDrawerOpen(false)

  return (
    <>
      <div className='flex shrink-0 items-center lg:hidden'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-8'
          aria-label={t('Open navigation menu')}
          aria-expanded={isDrawerOpen}
          aria-haspopup='dialog'
          onClick={() => setIsDrawerOpen(true)}
        >
          <Menu className='size-[1.15rem]' aria-hidden='true' />
        </Button>

        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetContent
            side='left'
            className='w-72 max-w-[85vw] gap-0 p-0'
          >
            <SheetHeader className='border-border border-b py-3 ps-4 pe-12'>
              <SheetTitle>{t('Navigation')}</SheetTitle>
              <SheetDescription className='sr-only'>
                {t('Main navigation links')}
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label={t('Navigation')}
              className='flex flex-col gap-1 p-2'
            >
              {normalizedLinks.map(
                ({ title, href, isActive, disabled, external }) => {
                  const linkClassName = cn(
                    DRAWER_LINK_CLASS,
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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
                        onClick={closeDrawer}
                        className={linkClassName}
                      >
                        <span className='min-w-0 truncate'>{title}</span>
                      </a>
                    )
                  }

                  return (
                    <Link
                      key={`${title}:${href}`}
                      to={href}
                      title={title}
                      disabled={disabled}
                      onClick={closeDrawer}
                      className={linkClassName}
                    >
                      <span className='min-w-0 truncate'>{title}</span>
                    </Link>
                  )
                }
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <nav
        className={cn('hidden min-w-0 items-center gap-0.5 lg:flex', className)}
        {...props}
      >
        {normalizedLinks.map(
          ({ title, href, isActive, disabled, external }) => {
            const linkClassName = cn(
              HORIZONTAL_LINK_CLASS,
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
    </>
  )
}
