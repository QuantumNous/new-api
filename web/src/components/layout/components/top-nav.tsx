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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import type { TopNavLink } from '../types'

type TopNavProps = React.HTMLAttributes<HTMLElement> & {
  links: TopNavLink[]
  variant?: 'responsive' | 'inline'
}

/**
 * 顶部导航栏组件
 * 在大屏幕显示水平导航，在小屏幕显示下拉菜单
 */
export function TopNav({
  className,
  links,
  variant = 'responsive',
  ...props
}: TopNavProps) {
  const { t } = useTranslation()
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
      {variant === 'responsive' && (
        <div className='xl:hidden'>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={t('Open navigation')}
              render={<Button size='icon' variant='ghost' className='size-8' />}
            >
              <Menu aria-hidden='true' />
            </DropdownMenuTrigger>
            <DropdownMenuContent side='bottom' align='start'>
              <DropdownMenuGroup>
                {normalizedLinks.map(
                  ({ title, href, isActive, disabled, external }) => {
                    let menuLink = <span>{title}</span>
                    if (!disabled) {
                      menuLink = external ? (
                        <a
                          href={href}
                          target='_blank'
                          rel='noopener noreferrer'
                          className={!isActive ? 'text-muted-foreground' : ''}
                        >
                          {title}
                        </a>
                      ) : (
                        <Link
                          to={href}
                          className={!isActive ? 'text-muted-foreground' : ''}
                          disabled={disabled}
                        >
                          {title}
                        </Link>
                      )
                    }
                    return (
                      <DropdownMenuItem
                        key={`${title}-${href}`}
                        disabled={disabled}
                        render={menuLink}
                      />
                    )
                  }
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* 桌面端水平导航 */}
      <nav
        aria-label={t('Main navigation')}
        className={cn(
          'items-center gap-3 whitespace-nowrap',
          variant === 'inline' ? 'flex' : 'me-2 hidden xl:flex',
          className
        )}
        {...props}
      >
        {normalizedLinks.map(
          ({ title, href, isActive, disabled, external }) => {
            if (disabled) {
              return (
                <span
                  key={`${title}-${href}`}
                  role='link'
                  aria-disabled='true'
                  className='text-muted-foreground opacity-50'
                >
                  {title}
                </span>
              )
            }
            return external ? (
              <a
                key={`${title}-${href}`}
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className={`hover:text-primary text-sm font-medium transition-colors ${isActive ? '' : 'text-muted-foreground'}`}
              >
                {title}
              </a>
            ) : (
              <Link
                key={`${title}-${href}`}
                to={href}
                disabled={disabled}
                className={`hover:text-primary text-sm font-medium transition-colors ${isActive ? '' : 'text-muted-foreground'}`}
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
