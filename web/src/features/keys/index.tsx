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
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { ApiKeysDialogs } from './components/api-keys-dialogs'
import { ApiKeysPrimaryButtons } from './components/api-keys-primary-buttons'
import { ApiKeysProvider } from './components/api-keys-provider'
import { ApiKeysTable } from './components/api-keys-table'
import { PrimaryApiKeyCard } from './components/primary-api-key-card'

export function ApiKeys() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const role = useAuthStore((state) => state.auth.user?.role ?? ROLE.GUEST)
  const singleMode =
    status?.single_primary_api_key_enabled === true && role === ROLE.USER
  return (
    <ApiKeysProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {singleMode ? t('My API Key') : t('API Keys')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          {!singleMode && <ApiKeysPrimaryButtons />}
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          {singleMode ? <PrimaryApiKeyCard /> : <ApiKeysTable />}
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ApiKeysDialogs />
    </ApiKeysProvider>
  )
}
