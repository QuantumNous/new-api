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
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { defaultTopNavLinks } from '../config/top-nav.config'
import { type TopNavLink } from '../types'

interface PublicNavigationProps {
  /**
   * Custom navigation links
   * If not provided, will use dynamic links from backend or defaults
   */
  links?: TopNavLink[]
  /**
   * Additional className
   */
  className?: string
}

/**
 * Public navigation component that matches Launch UI template styling
 * Used in PublicHeader for desktop navigation
 */
export function PublicNavigation({
  links: providedLinks,
  className,
}: PublicNavigationProps = {}) {
  const dynamicLinks = useTopNavLinks()
  const defaultLinks = providedLinks || defaultTopNavLinks
  const links = dynamicLinks.length > 0 ? dynamicLinks : defaultLinks

  // 递归渲染导航节点组件（支持子菜单）
  const renderNavLink = (link: TopNavLink, index: number) => {
    const hasChildren = link.children && link.children.length > 0

    if (hasChildren) {
      return (
        <DropdownMenu key={index} modal={false}>
          <DropdownMenuTrigger className='text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors focus:outline-none gap-1 select-none outline-none'>
            {link.title}
            <ChevronDown className='size-3.5 opacity-60' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='min-w-40'>
            {link.children!.map((child, childIdx) => renderDropdownItem(child, childIdx))}
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
          className={cn(
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
            link.disabled && 'pointer-events-none opacity-50'
          )}
        >
          {link.title}
        </a>
      )
    }

    return (
      <Link
        key={index}
        to={link.href}
        className={cn(
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
          link.disabled && 'pointer-events-none opacity-50'
        )}
      >
        {link.title}
      </Link>
    )
  }

  // 递归渲染下拉项（支持三级或多级子导航嵌套，并使用 UI 框架专属的 render 属性渲染）
  const renderDropdownItem = (child: TopNavLink, childIdx: number) => {
    const hasSubChildren = child.children && child.children.length > 0

    if (hasSubChildren) {
      return (
        <DropdownMenuSub key={childIdx}>
          <DropdownMenuSubTrigger className='cursor-default select-none'>
            {child.title}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className='min-w-40'>
            {child.children!.map((subChild, subIdx) => renderDropdownItem(subChild, subIdx))}
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
    <nav className={cn('hidden items-center gap-1 md:flex', className)}>
      {links.map((link, index) => renderNavLink(link, index))}
    </nav>
  )
}
