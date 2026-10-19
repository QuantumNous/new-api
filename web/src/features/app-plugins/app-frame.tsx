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

import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/components/main'
import { LoadingState } from '@/components/loading-state'

import { useEmbeddedAuth } from './use-embedded-auth'

export function AppFrame(props: { appKey: string }) {
  const { t } = useTranslation()
  const auth = useEmbeddedAuth(props.appKey)

  if (auth.isPending) {
    return (
      <Main>
        <LoadingState className='flex-1' />
      </Main>
    )
  }

  if (auth.error || !auth.src) {
    return (
      <Main>
        <ErrorState description={t(auth.error?.message ?? 'App unavailable')} />
      </Main>
    )
  }

  /* oxlint-disable react/iframe-missing-sandbox -- The app contract requires scripts and same-origin APIs inside the isolated frame. */
  return (
    <Main className='p-0'>
      <iframe
        ref={auth.iframeRef}
        title={auth.title}
        src={auth.src}
        referrerPolicy='no-referrer'
        className='h-full min-h-0 w-full border-0'
        sandbox='allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox'
        allow='clipboard-read; clipboard-write'
      />
    </Main>
  )
  /* oxlint-enable react/iframe-missing-sandbox */
}
