import React, { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronRight,
  Laptop,
  Moon,
  Sun,
  Search,
  Users,
  Key,
  Server,
  BarChart3,
  Settings,
  Database,
  Activity,
  FileText,
  Zap,
} from 'lucide-react'
import { getStoredUser } from '@/lib/auth'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const [searchTerm, setSearchTerm] = useState('')

  const user = getStoredUser()
  const isAdmin = user && (user as any).role >= 10

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const quickActions = [
    {
      id: 'dashboard-search',
      title: 'Search Dashboard Data',
      description: 'Search usage data by date range and user',
      icon: <BarChart3 className='h-4 w-4' />,
      action: () => navigate({ to: '/dashboard', search: { tab: 'search' } }),
    },
    {
      id: 'user-search',
      title: 'Search Users',
      description: 'Find users by ID, username, email or group',
      icon: <Users className='h-4 w-4' />,
      action: () => navigate({ to: '/users', search: { filter: 'search' } }),
      adminOnly: false,
    },
    {
      id: 'token-search',
      title: 'Search API Tokens',
      description: 'Find and manage API tokens',
      icon: <Key className='h-4 w-4' />,
      action: () => navigate({ to: '/tokens', search: { filter: 'search' } }),
    },
    {
      id: 'channel-search',
      title: 'Search Channels',
      description: 'Find channels by name, model, or group',
      icon: <Server className='h-4 w-4' />,
      action: () => navigate({ to: '/channels', search: { filter: 'search' } }),
      adminOnly: true,
    },
    {
      id: 'model-search',
      title: 'Search Models',
      description: 'Find models by name or vendor',
      icon: <Zap className='h-4 w-4' />,
      action: () => navigate({ to: '/models', search: { filter: 'search' } }),
      adminOnly: true,
    },
    {
      id: 'logs-search',
      title: 'Search Usage Logs',
      description: 'Find API call logs and usage statistics',
      icon: <Activity className='h-4 w-4' />,
      action: () => navigate({ to: '/logs', search: { filter: 'search' } }),
    },
  ]

  const filteredActions = quickActions.filter(
    (action) =>
      action.adminOnly === undefined ||
      action.adminOnly === false ||
      (action.adminOnly && isAdmin)
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <ScrollArea type='hover' className='h-96 pe-1'>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Quick Search Actions */}
          {filteredActions.length > 0 && (
            <CommandGroup heading='Quick Search'>
              {filteredActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`${action.title} ${action.description}`}
                  onSelect={() => runCommand(action.action)}
                >
                  <div className='mr-3 flex h-4 w-4 items-center justify-center'>
                    {action.icon}
                  </div>
                  <div className='flex flex-col'>
                    <span className='font-medium'>{action.title}</span>
                    <span className='text-muted-foreground text-xs'>
                      {action.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* Navigation */}
          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='text-muted-foreground/80 size-2' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`${navItem.title}-${subItem.url}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
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
              <Sun /> <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Dark</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
