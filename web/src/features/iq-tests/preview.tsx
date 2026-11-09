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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'

import { buildIQPreviewDocument, IQ_PREVIEW_SANDBOX } from './preview-document'
import { useIQArtifact } from './queries'
import type { IQResult } from './types'

export function IQPreview(props: {
  scope: string
  result: IQResult
  expanded?: boolean
}) {
  const { t } = useTranslation()
  const query = useIQArtifact(props.scope, props.result)
  const srcDoc = useMemo(() => {
    if (!query.data || query.isError) return null
    try {
      return buildIQPreviewDocument(query.data.artifact)
    } catch {
      return null
    }
  }, [query.data, query.isError])
  if (query.isPending) return <LoadingState className='min-h-40' />
  if (!srcDoc) {
    return (
      <ErrorState
        className='min-h-40'
        title={t('Preview unavailable. Refresh the gallery.')}
      />
    )
  }
  return (
    <iframe
      title={t('Artwork by {{model}}', { model: props.result.model })}
      sandbox={IQ_PREVIEW_SANDBOX}
      referrerPolicy='no-referrer'
      srcDoc={srcDoc}
      tabIndex={props.expanded ? 0 : -1}
      className={
        props.expanded
          ? 'h-[65dvh] w-full border-0 bg-white'
          : 'pointer-events-none h-64 w-full border-0 bg-white'
      }
    />
  )
}
