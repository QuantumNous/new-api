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
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OPERATIONS_CONSOLE_OVERVIEW_PATH } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const backButtonClassName = cn(
  'mb-2 w-full rounded-xl border border-white/10',
  'text-slate-200 hover:bg-white/10 hover:text-white',
  'data-active:bg-white/10 data-active:text-white'
)

/**
 * Shown only on the system-settings workspace sidebar (see AppSidebar).
 * Plain link back to the operations overview — does not alter workspace registry data.
 */
export function SidebarBackToOperationsConsole() {
  const { t } = useTranslation()
  const { setOpenMobile } = useSidebar()
  const label = t('Back to Operations Console')

  return (
    <SidebarMenu className='mb-1 px-0'>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className={backButtonClassName}
          tooltip={label}
          render={
            <Link
              to={OPERATIONS_CONSOLE_OVERVIEW_PATH}
              onClick={() => setOpenMobile(false)}
            />
          }
        >
          <ArrowLeft className='size-4 shrink-0' />
          <span className='truncate group-data-[collapsible=icon]:hidden'>
            {label}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
