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

import { CopyButton } from '@/components/copy-button'
import { SectionPageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { useStatus } from '@/hooks/use-status'

import { ApiKeysDialogs } from './components/api-keys-dialogs'
import { ApiKeysPrimaryButtons } from './components/api-keys-primary-buttons'
import { ApiKeysProvider } from './components/api-keys-provider'
import { ApiKeysTable } from './components/api-keys-table'

export function ApiKeys() {
  const { t } = useTranslation()
  const { status } = useStatus()

  const configuredAddress =
    status?.server_address ??
    status?.serverAddress ??
    status?.data?.server_address ??
    status?.data?.serverAddress
  const serverAddress =
    typeof configuredAddress === 'string' && configuredAddress
      ? configuredAddress.replace(/\/+$/, '')
      : window.location.origin

  return (
    <ApiKeysProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          <span className='flex min-w-0 items-center gap-2'>
            <span className='shrink-0'>{t('Keys')}</span>
            <CopyButton
              value={serverAddress}
              trailingIcon
              size='sm'
              className='ml-auto h-auto min-h-7 min-w-0 shrink justify-start gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground'
              iconClassName='shrink-0'
              tooltip={t('Copy to clipboard')}
              aria-label={t('Copy to clipboard')}
            >
              <span className='min-w-0 truncate'>{serverAddress}</span>
            </CopyButton>
          </span>
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <ApiKeysPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <Card className='h-full min-h-0 gap-0 py-0'>
            <CardContent className='flex min-h-0 flex-1 flex-col p-3 sm:p-4'>
              <ApiKeysTable />
            </CardContent>
          </Card>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ApiKeysDialogs />
    </ApiKeysProvider>
  )
}
