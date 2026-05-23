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
import { topNavCenterZoneClassName } from '@/lib/ops-ui-styles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type TopNavLink } from '../types'
import { TopNavDesktop } from './top-nav-desktop'

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

      <TopNavDesktop
        links={links}
        tone={tone}
        className={cn(topNavCenterZoneClassName, className)}
        {...props}
      />
    </>
  )
}
