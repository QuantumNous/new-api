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
import { useMemo } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  opsConsoleHeaderNavLinkActiveClassName,
  opsConsoleHeaderNavLinkClassName,
  portalHeaderNavLinkActiveClassName,
  portalHeaderNavLinkClassName,
  topNavDesktopNavClassName,
  topNavLinksListClassName,
} from '@/lib/ops-ui-styles'
import { cn } from '@/lib/utils'
import { type TopNavLink } from '../types'

type TopNavDesktopProps = React.HTMLAttributes<HTMLElement> & {
  links: TopNavLink[]
  tone?: 'portal' | 'default' | 'ops-console'
  onLinkClick?: (
    event: React.MouseEvent<HTMLAnchorElement>,
    link: TopNavLink
  ) => void
}

/**
 * Desktop primary nav — centered link group, no truncate, shared by public + app headers.
 */
export function TopNavDesktop({
  links,
  tone = 'default',
  className,
  onLinkClick,
  ...props
}: TopNavDesktopProps) {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPortalTone = tone === 'portal'
  const isOpsConsoleTone = tone === 'ops-console'

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

  const linkClass = (active: boolean) => {
    if (isOpsConsoleTone) {
      return active
        ? opsConsoleHeaderNavLinkActiveClassName
        : opsConsoleHeaderNavLinkClassName
    }
    if (isPortalTone) {
      return active
        ? portalHeaderNavLinkActiveClassName
        : portalHeaderNavLinkClassName
    }
    return cn(
      'inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-200',
      active
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    )
  }

  return (
    <nav
      className={cn(topNavDesktopNavClassName, className)}
      aria-label='Main navigation'
      {...props}
    >
      <div className={topNavLinksListClassName}>
        {normalizedLinks.map((link, i) => {
          const isActive =
            link.isActive ??
            (!link.external && pathname === link.href.split('?')[0])
          const cls = linkClass(isActive)

          if (link.external) {
            return (
              <a
                key={`${link.title}-${link.href}`}
                href={link.href}
                target='_blank'
                rel='noopener noreferrer'
                aria-disabled={link.disabled}
                tabIndex={link.disabled ? -1 : undefined}
                onClick={(event) => onLinkClick?.(event, link)}
                className={cls}
              >
                {t(link.title)}
              </a>
            )
          }

          return (
            <Link
              key={`${link.title}-${link.href}`}
              to={link.href}
              disabled={link.disabled}
              onClick={(event) => onLinkClick?.(event, link)}
              className={cls}
            >
              {t(link.title)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
