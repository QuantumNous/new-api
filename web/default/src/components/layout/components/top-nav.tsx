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
import { Menu } from 'lucide-react'
import {
  portalHeaderNavLinkActiveClassName,
  portalHeaderNavLinkClassName,
} from '@/lib/ops-ui-styles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type TopNavLink } from '../types'

type TopNavProps = React.HTMLAttributes<HTMLElement> & {
  links: TopNavLink[]
  /** Bright nav on dark app header (matches public portal header). */
  tone?: 'portal' | 'default'
}

/**
 * 顶部导航栏组件
 * 在大屏幕显示水平导航，在小屏幕显示下拉菜单
 */
export function TopNav({ className, links, tone = 'default', ...props }: TopNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPortalTone = tone === 'portal'

  const linkClass = (active: boolean) =>
    isPortalTone
      ? active
        ? portalHeaderNavLinkActiveClassName
        : portalHeaderNavLinkClassName
      : cn(
          'text-sm font-medium transition-colors',
          active
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )

  const mobileLinkClass = (active: boolean) =>
    isPortalTone
      ? active
        ? 'font-semibold text-white'
        : 'text-slate-200'
      : active
        ? ''
        : 'text-muted-foreground'

  // 规范化链接，确保所有可选属性都有默认值
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
    <>
      {/* 移动端下拉菜单 */}
      <div className='lg:hidden'>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={<Button size='icon' variant='outline' className='size-7' />}
          >
            <Menu />
          </DropdownMenuTrigger>
          <DropdownMenuContent side='bottom' align='start'>
            {normalizedLinks.map((link) => {
              const active =
                link.isActive ??
                (!link.external && pathname === link.href.split('?')[0])
              return (
                <DropdownMenuItem
                  key={`${link.title}-${link.href}`}
                  render={
                    link.external ? (
                      <a
                        href={link.href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={mobileLinkClass(active)}
                      >
                        {link.title}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className={mobileLinkClass(active)}
                        disabled={link.disabled}
                      >
                        {link.title}
                      </Link>
                    )
                  }
                />
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 桌面端水平导航 */}
      <nav
        className={cn(
          'hidden items-center space-x-4 lg:flex lg:space-x-4 xl:space-x-6',
          className
        )}
        {...props}
      >
        {normalizedLinks.map((link) => {
          const active =
            link.isActive ??
            (!link.external && pathname === link.href.split('?')[0])
          const cls = linkClass(active)
          return link.external ? (
            <a
              key={`${link.title}-${link.href}`}
              href={link.href}
              target='_blank'
              rel='noopener noreferrer'
              className={cls}
            >
              {link.title}
            </a>
          ) : (
            <Link
              key={`${link.title}-${link.href}`}
              to={link.href}
              disabled={link.disabled}
              className={cls}
            >
              {link.title}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
