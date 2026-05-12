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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../../components/settings-section'
import { ProviderFormDialog } from './components/provider-form-dialog'
import { ProviderTable } from './components/provider-table'
import { useCustomOAuthProviders } from './hooks/use-custom-oauth-providers'
import type { CustomOAuthProvider } from './types'

export function CustomOAuthSection() {
  const { t } = useTranslation()
  const { data: providers = [], isLoading } = useCustomOAuthProviders()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] =
    useState<CustomOAuthProvider | null>(null)

  const handleCreate = () => {
    setEditingProvider(null)
    setDialogOpen(true)
  }

  const handleEdit = (provider: CustomOAuthProvider) => {
    setEditingProvider(provider)
    setDialogOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingProvider(null)
    }
  }

  if (isLoading) {
    return (
      <SettingsSection
        title={t('Custom OAuth Providers')}
        description={t(
          'Configure custom OAuth providers for user authentication'
        )}
      >
        <div className='text-muted-foreground py-8 text-center text-sm'>
          {t('Loading...')}
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title={t('Custom OAuth Providers')}
      description={t(
        'Configure custom OAuth providers for user authentication'
      )}
    >
      <ProviderTable
        providers={providers}
        onEdit={handleEdit}
        onCreate={handleCreate}
      />

      <ProviderFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        provider={editingProvider}
      />
    </SettingsSection>
  )
}
