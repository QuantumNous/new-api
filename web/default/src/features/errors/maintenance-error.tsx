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
import { Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ErrorPage } from './error-page'

export function MaintenanceError() {
  const { t } = useTranslation()
  return (
    <ErrorPage
      code='503'
      icon={<Wrench />}
      iconTone='info'
      title={t('Under maintenance')}
      description={t(
        "We're doing a short upgrade. Please try again in a few minutes."
      )}
      actions={
        <Button variant='outline' onClick={() => window.location.reload()}>
          {t('Try again')}
        </Button>
      }
    />
  )
}
