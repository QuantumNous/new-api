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
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { CiStatusPage } from '@/components/layout/components/ci-status-page'

export function UnauthorisedError() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <CiStatusPage
      code={401}
      title={t('Unauthorized Access')}
      description={
        <>
          {t('Please log in with the appropriate credentials')}
          <br />
          {t('to access this resource.')}
        </>
      }
      actions={
        <>
          <button
            type='button'
            className='ci-button ci-button--outline ci-button--size-sm'
            onClick={() => history.go(-1)}
          >
            {t('Go Back')}
          </button>
          <button
            type='button'
            className='ci-button ci-button--size-sm'
            onClick={() => navigate({ to: '/' })}
          >
            {t('Back to Home')}
          </button>
        </>
      }
    />
  )
}
