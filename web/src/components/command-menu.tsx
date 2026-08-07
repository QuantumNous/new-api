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
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useSearch } from '@/context/search-context'
import { useTheme } from '@/context/theme-provider'
import { useSidebarView } from '@/hooks/use-sidebar-view'

import { navigateCommandTarget } from './command-navigation'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  // Reuse the exact role/config-filtered navigation shown in the sidebar.
  // Keeping a second unfiltered source here would expose admin commands to
  // regular users and could route external pages through the SPA router.
  const { navGroups } = useSidebarView()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder={t('Type a command or search...')} />
        <CommandList>
          <ScrollArea className='h-72 pe-1'>
            <CommandEmpty>{t('No results found.')}</CommandEmpty>
            {navGroups.map((group) => (
              <CommandGroup key={group.id || group.title} heading={group.title}>
                {group.items.map((navItem) => {
                  if (navItem.url) {
                    return (
                      <CommandItem
                        key={`${group.id ?? group.title}:${navItem.url}`}
                        value={navItem.title}
                        onSelect={() => {
                          runCommand(() =>
                            navigateCommandTarget(navItem, navigate)
                          )
                        }}
                      >
                        <div className='flex size-4 items-center justify-center'>
                          <ArrowRight className='text-muted-foreground/80 size-2' />
                        </div>
                        {navItem.title}
                      </CommandItem>
                    )
                  }

                  return navItem.items?.map((subItem) => (
                    <CommandItem
                      key={`${group.id ?? group.title}:${navItem.title}:${subItem.url}`}
                      value={`${navItem.title}-${subItem.url}`}
                      onSelect={() => {
                        runCommand(() =>
                          navigateCommandTarget(subItem, navigate)
                        )
                      }}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='text-muted-foreground/80 size-2' />
                      </div>
                      {navItem.title} <ChevronRight /> {subItem.title}
                    </CommandItem>
                  ))
                })}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup heading='Theme'>
              <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
                <Sun /> <span>{t('Light')}</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
                <Moon className='scale-90' />
                <span>{t('Dark')}</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => setTheme('system'))}
              >
                <Laptop />
                <span>{t('System')}</span>
              </CommandItem>
            </CommandGroup>
          </ScrollArea>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
