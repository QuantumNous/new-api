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
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { type ReactNode, useState, useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { checkIsActive } from '../lib/url-utils'
import type {
  NavCollapsible,
  NavChatPresets,
  NavLink,
  NavGroup as NavGroupProps,
} from '../types'
import { ChatPresetsItem } from './chat-presets-item'

const highlightColors = {
  blue: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 hover:text-blue-700 data-active:bg-blue-500/20 data-active:text-blue-700 data-active:hover:bg-blue-500/20 data-active:hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300 dark:data-active:text-blue-300 dark:data-active:hover:text-blue-300',
  green:
    'bg-green-500/10 text-green-700 hover:bg-green-500/15 hover:text-green-700 data-active:bg-green-500/20 data-active:text-green-700 data-active:hover:bg-green-500/20 data-active:hover:text-green-700 dark:text-green-300 dark:hover:text-green-300 dark:data-active:text-green-300 dark:data-active:hover:text-green-300',
  purple:
    'bg-purple-500/10 text-purple-700 hover:bg-purple-500/15 hover:text-purple-700 data-active:bg-purple-500/20 data-active:text-purple-700 data-active:hover:bg-purple-500/20 data-active:hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-300 dark:data-active:text-purple-300 dark:data-active:hover:text-purple-300',
  orange:
    'bg-orange-500/10 text-orange-700 hover:bg-orange-500/15 hover:text-orange-700 data-active:bg-orange-500/20 data-active:text-orange-700 data-active:hover:bg-orange-500/20 data-active:hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-300 dark:data-active:text-orange-300 dark:data-active:hover:text-orange-300',
  red: 'bg-red-500/10 text-red-700 hover:bg-red-500/15 hover:text-red-700 data-active:bg-red-500/20 data-active:text-red-700 data-active:hover:bg-red-500/20 data-active:hover:text-red-700 dark:text-red-300 dark:hover:text-red-300 dark:data-active:text-red-300 dark:data-active:hover:text-red-300',
}

/**
 * Sidebar navigation group component
 * Renders a group of navigation items, supporting regular links and collapsible submenus
 */
export function NavGroup({ title, items }: NavGroupProps) {
  const { state, isMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })

  return (
    <SidebarGroup className='px-2 py-1'>
      <SidebarGroupLabel className='text-muted-foreground/70 px-2 text-[11px] font-medium tracking-wider uppercase'>
        {title}
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${item.url || item.type}`

          // Special handling: dynamic chat presets list
          if (item.type === 'chat-presets') {
            return <ChatPresetsItem key={key} item={item as NavChatPresets} />
          }

          // If no sub-items, render regular link
          if (!item.items) {
            return (
              <SidebarMenuLink key={key} item={item as NavLink} href={href} />
            )
          }

          // In collapsed state on non-mobile, render dropdown menu
          if (state === 'collapsed' && !isMobile) {
            return (
              <SidebarMenuCollapsedDropdown
                key={key}
                item={item as NavCollapsible}
                href={href}
              />
            )
          }

          // Render collapsible menu
          return (
            <SidebarMenuCollapsible
              key={key}
              item={item as NavCollapsible}
              href={href}
            />
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/**
 * Navigation badge component
 */
function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='shrink-0 px-1 py-0 text-xs'>{children}</Badge>
}

/**
 * Sidebar menu link item
 */
function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={checkIsActive(href, item)}
        className={cn(
          item.highlight && 'font-semibold',
          item.highlight &&
            (item.highlightColor
              ? highlightColors[item.highlightColor]
              : 'text-primary bg-primary/10')
        )}
        tooltip={item.title}
        render={
          <Link
            to={item.url}
            preload={isMobile ? false : undefined}
            onClick={() => setOpenMobile(false)}
          />
        }
      >
        {item.icon && <item.icon className='shrink-0' />}
        <span className='min-w-0 flex-1 truncate'>{item.title}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * Sidebar collapsible menu item
 */
function SidebarMenuCollapsible({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  // 检查当前路径是否匹配子菜单项
  const isSubItemActive = checkIsActive(href, item)
  // 使用受控状态，初始值基于当前路径是否匹配
  const [isOpen, setIsOpen] = useState(() => isSubItemActive)

  // 当路径变化时，如果匹配子菜单项，自动展开父级菜单
  useEffect(() => {
    if (isSubItemActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true)
    }
  }, [isSubItemActive])

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className='group/collapsible'
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        className='group/collapsible-trigger'
        render={<SidebarMenuButton tooltip={item.title} />}
      >
        {item.icon && <item.icon className='shrink-0' />}
        <span className='min-w-0 flex-1 truncate'>{item.title}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
        <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90' />
      </CollapsibleTrigger>
      <CollapsibleContent className='CollapsibleContent'>
        <SidebarMenuSub>
          {item.items.map((subItem) => (
            <SidebarMenuSubItem key={subItem.title}>
              <SidebarMenuSubButton
                isActive={checkIsActive(href, subItem)}
                render={
                  <Link
                    to={subItem.url}
                    preload={isMobile ? false : undefined}
                    onClick={() => setOpenMobile(false)}
                  />
                }
              >
                {subItem.icon && <subItem.icon className='shrink-0' />}
                <span className='min-w-0 flex-1 truncate'>{subItem.title}</span>
                {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Sidebar dropdown menu item when collapsed
 */
function SidebarMenuCollapsedDropdown({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          className='group/dropdown-trigger'
          render={
            <SidebarMenuButton
              tooltip={item.title}
              isActive={checkIsActive(href, item)}
            />
          }
        >
          {item.icon && <item.icon className='shrink-0' />}
          <span className='min-w-0 flex-1 truncate'>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
          <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[popup-open]/dropdown-trigger:rotate-90' />
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {item.title} {item.badge ? `(${item.badge})` : ''}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {item.items.map((sub) => (
              <DropdownMenuItem
                key={`${sub.title}-${sub.url}`}
                render={
                  <Link
                    to={sub.url}
                    className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
                  />
                }
              >
                {sub.icon && <sub.icon />}
                <span className='max-w-52 text-wrap'>{sub.title}</span>
                {sub.badge && (
                  <span className='ms-auto text-xs'>{sub.badge}</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
