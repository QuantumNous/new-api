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
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionPageLayout } from '@/components/layout'
import { ApiKeysDialogs } from './components/api-keys-dialogs'
import { ApiKeysPrimaryButtons } from './components/api-keys-primary-buttons'
import { ApiKeysProvider } from './components/api-keys-provider'
import { ApiKeysTable } from './components/api-keys-table'

const IMAGE_BASE_URL = 'https://image.newtonrouter.com'

export function ApiKeys() {
  const { t } = useTranslation()
  const { config } = useSystemConfigStore()
  const serverAddress =
    config.serverAddress ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('已复制到剪切板'))
    } catch {
      toast.error(t('复制失败'))
    }
  }

  const urlItems = [
    { label: 'BaseUrl:', value: serverAddress },
    { label: '图像专用Url:', value: IMAGE_BASE_URL },
  ]

  return (
    <ApiKeysProvider>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('API Keys')}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Manage your API keys for accessing the service')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <ApiKeysPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-12'>
            {urlItems.map((item) => (
              <div key={item.label} className='flex items-center gap-1.5'>
                <span className='text-muted-foreground shrink-0 text-sm font-medium'>
                  {item.label}
                </span>
                <div className='relative'>
                  <Input
                    readOnly
                    value={item.value}
                    className='h-8 w-[280px] pr-10 text-sm'
                  />
                  <Button
                    variant='ghost'
                    size='icon'
                    className='absolute top-0 right-0 h-8 w-8'
                    onClick={() => handleCopyUrl(item.value)}
                  >
                    <Copy className='h-3 w-3' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <ApiKeysTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ApiKeysDialogs />
    </ApiKeysProvider>
  )
}
