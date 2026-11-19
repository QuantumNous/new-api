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

import { SectionPageLayout } from '@/components/layout'
import { useAuthStore } from '@/stores/auth-store'

export function OverviewDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Overview')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <section className='bg-card rounded-xl border p-5 shadow-xs sm:p-6'>
          <h2 className='text-lg font-semibold tracking-tight'>
            {t('Welcome, {{name}}', { name: user?.display_name || user?.username || '' })}
          </h2>
          <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-6'>
            {t('Your application foundation is ready. General administration and account access are available while business modules are being prepared.')}
          </p>
        </section>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
