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
import React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, CornerDownLeft, Laptop, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getNavGroupsForPath } from './layout/lib/workspace-registry'

const ITEM_CLASS =
  'h-9 rounded-md border border-transparent px-3! font-medium data-selected:border-input data-selected:bg-input/50 data-selected:text-foreground'

export function CommandMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const { pathname } = useLocation()
  const sidebarData = useSidebarData()

  const navGroups = getNavGroupsForPath(pathname, t) || sidebarData.navGroups

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          data-slot='dialog-content'
          className={cn(
            'fixed top-[15%] left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 outline-none sm:max-w-lg',
            'rounded-xl border-none bg-clip-padding p-2 pb-11 shadow-2xl',
            'ring-4 ring-neutral-200/80 dark:ring-neutral-800',
            'bg-popover text-popover-foreground dark:bg-neutral-900'
          )}
        >
          <DialogHeader className='sr-only'>
            <DialogTitle>{t('Search')}</DialogTitle>
            <DialogDescription>{t('Type a command or search...')}</DialogDescription>
          </DialogHeader>
          <Command
            className={cn(
              'rounded-none bg-transparent',
              '**:data-[slot=command-input-wrapper]:mb-0',
              '**:data-[slot=command-input-wrapper]:h-9!',
              '**:data-[slot=command-input-wrapper]:rounded-md',
              '**:data-[slot=command-input-wrapper]:border',
              '**:data-[slot=command-input-wrapper]:border-input',
              '**:data-[slot=command-input-wrapper]:bg-input/50'
            )}
          >
            <CommandInput placeholder={t('Type a command or search...')} />
            <CommandList className='no-scrollbar min-h-80 scroll-pt-2 scroll-pb-1.5'>
              <CommandEmpty className='py-12 text-center text-sm text-muted-foreground'>
                {t('No results found.')}
              </CommandEmpty>
              {navGroups.map((group) => (
                <CommandGroup
                  key={group.id || group.title}
                  heading={group.title}
                  className='p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!'
                >
                  {group.items.map((navItem, i) => {
                    if (navItem.url)
                      return (
                        <CommandItem
                          key={`${navItem.url}-${i}`}
                          value={navItem.title}
                          className={ITEM_CLASS}
                          onSelect={() => {
                            runCommand(() => navigate({ to: navItem.url }))
                          }}
                        >
                          <ArrowRight className='size-3.5' />
                          {navItem.title}
                        </CommandItem>
                      )

                    return navItem.items?.map((subItem, i) => (
                      <CommandItem
                        key={`${navItem.title}-${subItem.url}-${i}`}
                        value={`${navItem.title}-${subItem.url}`}
                        className={ITEM_CLASS}
                        onSelect={() => {
                          runCommand(() => navigate({ to: subItem.url }))
                        }}
                      >
                        <ArrowRight className='size-3.5' />
                        {navItem.title} <ChevronRight className='size-3' /> {subItem.title}
                      </CommandItem>
                    ))
                  })}
                </CommandGroup>
              ))}
              <CommandSeparator />
              <CommandGroup
                heading={t('Theme')}
                className='p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!'
              >
                <CommandItem
                  className={ITEM_CLASS}
                  onSelect={() => runCommand(() => setTheme('light'))}
                >
                  <Sun className='size-4' />
                  <span>{t('Light')}</span>
                </CommandItem>
                <CommandItem
                  className={ITEM_CLASS}
                  onSelect={() => runCommand(() => setTheme('dark'))}
                >
                  <Moon className='size-4 scale-90' />
                  <span>{t('Dark')}</span>
                </CommandItem>
                <CommandItem
                  className={ITEM_CLASS}
                  onSelect={() => runCommand(() => setTheme('system'))}
                >
                  <Laptop className='size-4' />
                  <span>{t('System')}</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <div className='absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-xl border-t border-t-neutral-100 bg-neutral-50 px-4 text-xs font-medium text-muted-foreground dark:border-t-neutral-700 dark:bg-neutral-800'>
            <div className='flex items-center gap-1'>
              <CommandMenuKbd>
                <CornerDownLeft className='size-3' />
              </CommandMenuKbd>
              <span>{t('Select')}</span>
            </div>
            <div className='flex items-center gap-1'>
              <CommandMenuKbd>↑</CommandMenuKbd>
              <CommandMenuKbd>↓</CommandMenuKbd>
              <span>{t('Navigate')}</span>
            </div>
            <div className='ml-auto flex items-center gap-1'>
              <CommandMenuKbd>⌘</CommandMenuKbd>
              <CommandMenuKbd>K</CommandMenuKbd>
              <span>{t('Toggle')}</span>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function CommandMenuKbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'pointer-events-none flex h-5 items-center justify-center gap-1 rounded border bg-background px-1 font-sans text-[0.7rem] font-medium text-muted-foreground select-none [&_svg:not([class*="size-"])]:size-3',
        className
      )}
      {...props}
    />
  )
}
