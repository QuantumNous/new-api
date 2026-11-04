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
import { CommandMenu } from '@/components/command-menu'
import { AnimatedOutlet } from '@/components/page-transition'
import { SkipToMain } from '@/components/skip-to-main'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { useHwCurrency } from '@/features/hw/hooks/use-hw-currency'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { AppHeader } from './app-header'
import { AppSidebar } from './app-sidebar'
import { Footer } from './footer'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout(props: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const signedIn = useAuthStore((s) => !!s.auth.user)
  // Console amounts are formatted outside React state (`lib/currency.ts`), so a
  // currency switch remounts the page to show every amount in the new currency.
  const { currency } = useHwCurrency()
  // Unmount pages on sign-out, otherwise their queries refetch and toast "Session expired!" / "invalid access token"
  if (!signedIn) return null

  return (
    <LayoutProvider>
      <SearchProvider>
        <SidebarProvider defaultOpen={defaultOpen} className='flex-col'>
          <SkipToMain />
          <AppHeader />
          <div className='flex min-h-0 w-full flex-1'>
            <AppSidebar />
            <SidebarInset
              className={cn(
                '@container/content',
                'h-[calc(100svh-var(--app-header-height,0px))]',
                'min-h-0 overflow-y-auto',
                'peer-data-[variant=inset]:h-[calc(100svh-var(--app-header-height,0px)-(var(--spacing)*4))]'
              )}
            >
              {/* The page fills the whole view and the footer sits below it, so
                  the footer scrolls into view at the end of every page instead
                  of taking a fixed slice of a small screen. */}
              <div
                key={currency}
                className='flex h-full min-h-0 shrink-0 flex-col'
              >
                {props.children ?? <AnimatedOutlet />}
              </div>
              <Footer variant='compact' />
            </SidebarInset>
          </div>
        </SidebarProvider>
        <CommandMenu />
      </SearchProvider>
    </LayoutProvider>
  )
}
