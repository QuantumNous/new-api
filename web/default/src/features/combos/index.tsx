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
import { CombosDialogs } from './components/combos-dialogs'
import { CombosPrimaryButtons } from './components/combos-primary-buttons'
import { CombosProvider } from './components/combos-provider'
import { CombosTable } from './components/combos-table'

export function Combos() {
  const { t } = useTranslation()
  return (
    <CombosProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Combos')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <CombosPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <CombosTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <CombosDialogs />
    </CombosProvider>
  )
}
