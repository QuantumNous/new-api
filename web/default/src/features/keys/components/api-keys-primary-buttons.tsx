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
import { DashboardSpeed01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useApiKeys } from './api-keys-provider'

export function ApiKeysPrimaryButtons() {
  const { t } = useTranslation()
  const { setCurrentRow, setOpen, setResolvedKey } = useApiKeys()

  const handleOpenApiTest = () => {
    setCurrentRow(null)
    setResolvedKey('')
    setOpen('api-test')
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button variant='outline' size='sm' onClick={handleOpenApiTest}>
        <HugeiconsIcon
          icon={DashboardSpeed01Icon}
          data-icon='inline-start'
          aria-hidden='true'
        />
        {t('Test API availability')}
      </Button>
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus data-icon='inline-start' />
        {t('Create API Key')}
      </Button>
    </div>
  )
}
