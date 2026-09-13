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
import { AuthenticatedLayout } from '@/components/layout/components/authenticated-layout'
import { PublicLayout } from '@/components/layout/components/public-layout'
import { GlassCursor } from '@/features/home/components/glass-cursor'
import { useConsoleMode } from '@/hooks/use-console-mode'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type CatalogPageLayoutProps = {
  children: React.ReactNode
  showMainContainer?: boolean
  fullWidth?: boolean
}

export function CatalogPageLayout(props: CatalogPageLayoutProps) {
  const user = useAuthStore((state) => state.auth.user)
  const mode = useConsoleMode()
  if (user) {
    return (
      <>
        {mode === 'developer' ? (
          <GlassCursor scopeSelector='.ci-app, .dopa-console, .ci-landing' />
        ) : null}
        <AuthenticatedLayout>
          <div
            data-catalog-layout={
              mode === 'developer' && props.fullWidth ? 'full-width' : undefined
            }
            className={cn(
              mode === 'developer' &&
                'min-h-0 flex-1 overflow-y-auto overscroll-contain',
              props.showMainContainer !== false && 'px-4 py-6'
            )}
          >
            {props.children}
          </div>
        </AuthenticatedLayout>
      </>
    )
  }
  return (
    <>
      <GlassCursor scopeSelector='.ci-landing' />
      <PublicLayout showMainContainer={props.showMainContainer}>
        {props.children}
      </PublicLayout>
    </>
  )
}
