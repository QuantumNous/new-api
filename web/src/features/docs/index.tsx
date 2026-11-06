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
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { useStatus } from '@/hooks/use-status'

import { ApiReferenceSection } from './components/api-reference'
import { DocsHero } from './components/docs-hero'
import { ManualSetupSection } from './components/manual-setup'
import { OneClickSetupSection } from './components/one-click-setup'
import { QuickStartSection } from './components/quick-start'
import { resolveGatewayUrl } from './lib/agent-setup'

const NAV_ITEMS = [
  { href: '#quick-start', label: 'Quick start' },
  { href: '#one-click-setup', label: 'One-click setup' },
  { href: '#manual-setup', label: 'Manual configuration' },
  { href: '#api-reference', label: 'API reference' },
] as const

export function Docs() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const gatewayUrl = resolveGatewayUrl(status as Record<string, unknown> | null)

  return (
    <PublicLayout showMainContainer={false}>
      <DocsHero gatewayUrl={gatewayUrl} />
      <div className='mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12'>
        <div className='grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]'>
          <main className='min-w-0 space-y-12'>
            <QuickStartSection />
            <OneClickSetupSection />
            <ManualSetupSection gatewayUrl={gatewayUrl} />
            <ApiReferenceSection gatewayUrl={gatewayUrl} />
          </main>

          <aside className='hidden lg:block'>
            <nav className='border-border/60 sticky top-24 space-y-2 border-l pl-4'>
              <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
                {t('On this page')}
              </p>
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className='text-muted-foreground hover:text-foreground block rounded-sm py-1 text-sm transition-colors'
                >
                  {t(item.label)}
                </a>
              ))}
            </nav>
          </aside>
        </div>
      </div>
      <Footer />
    </PublicLayout>
  )
}
