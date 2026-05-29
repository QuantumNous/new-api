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
import { Link } from '@tanstack/react-router'
import { ChevronDown, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { type TopNavLink } from '../types'

interface TopNavComponentProps extends React.HTMLAttributes<HTMLElement> {
  links: TopNavLink[]
}

/**
 * 顶部导航栏组件
 * 在大屏幕显示水平导航，支持二级下拉菜单；在小屏幕显示整合的移动端折叠下拉
 */
export function TopNav({ className, links, ...props }: TopNavComponentProps) {
  // 规范化链接属性
  const normalizedLinks = useMemo(() => {
    return links.map((link) => ({
      disabled: false,
      external: false,
      openInNewTab: false,
      ...link,
    }))
  }, [links])

  // 递归渲染移动端侧边菜单项
  const renderMobileMenuItem = (link: TopNavLink, index: number) => {
    const hasChildren = link.children && link.children.length > 0

    if (hasChildren) {
      return (
        <DropdownMenuSub key={index}>
          <DropdownMenuSubTrigger className='cursor-default select-none'>
            {link.title}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className='min-w-40'>
            {link.children!.map((child, childIdx) => renderMobileMenuItem(child, childIdx))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    return (
      <DropdownMenuItem
        key={index}
        render={
          link.external ? (
            <a
              href={link.href}
              target={link.openInNewTab ? '_blank' : '_self'}
              rel='noopener noreferrer'
              className={cn(
                'w-full cursor-pointer',
                link.disabled && 'pointer-events-none opacity-50'
              )}
            >
              {link.title}
            </a>
          ) : (
            <Link
              to={link.href}
              className={cn(
                'w-full cursor-pointer',
                link.disabled && 'pointer-events-none opacity-50'
              )}
            >
              {link.title}
            </Link>
          )
        }
      />
    )
  }

  // 递归渲染桌面端水平项
  const renderDesktopNavLink = (link: TopNavLink, index: number) => {
    const hasChildren = link.children && link.children.length > 0

    if (hasChildren) {
      return (
        <DropdownMenu key={index} modal={false}>
          <DropdownMenuTrigger className='hover:text-primary inline-flex items-center gap-1 text-sm font-medium transition-colors text-muted-foreground outline-none select-none'>
            {link.title}
            <ChevronDown className='size-3 opacity-60' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='min-w-40'>
            {link.children!.map((child, childIdx) => renderDesktopDropdownItem(child, childIdx))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    if (link.external) {
      return (
        <a
          key={index}
          href={link.href}
          target={link.openInNewTab ? '_blank' : '_self'}
          rel='noopener noreferrer'
          className='hover:text-primary text-sm font-medium transition-colors text-muted-foreground'
        >
          {link.title}
        </a>
      )
    }

    return (
      <Link
        key={index}
        to={link.href}
        className='hover:text-primary text-sm font-medium transition-colors text-muted-foreground'
      >
        {link.title}
      </Link>
    )
  }

  // 渲染桌面端下拉内部项
  const renderDesktopDropdownItem = (child: TopNavLink, childIdx: number) => {
    const hasSubChildren = child.children && child.children.length > 0

    if (hasSubChildren) {
      return (
        <DropdownMenuSub key={childIdx}>
          <DropdownMenuSubTrigger className='cursor-default select-none'>
            {child.title}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className='min-w-40'>
            {child.children!.map((subChild, subIdx) => renderDesktopDropdownItem(subChild, subIdx))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    return (
      <DropdownMenuItem
        key={childIdx}
        render={
          child.external ? (
            <a
              href={child.href}
              target={child.openInNewTab ? '_blank' : '_self'}
              rel='noopener noreferrer'
              className={cn(
                'w-full cursor-pointer',
                child.disabled && 'pointer-events-none opacity-50'
              )}
            >
              {child.title}
            </a>
          ) : (
            <Link
              to={child.href}
              className={cn(
                'w-full cursor-pointer',
                child.disabled && 'pointer-events-none opacity-50'
              )}
            >
              {child.title}
            </Link>
          )
        }
      />
    )
  }

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
          <DropdownMenuContent side='bottom' align='start' className='min-w-44'>
            {normalizedLinks.map((link, index) => renderMobileMenuItem(link, index))}
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
        {normalizedLinks.map((link, index) => renderDesktopNavLink(link, index))}
      </nav>
    </>
  )
}
