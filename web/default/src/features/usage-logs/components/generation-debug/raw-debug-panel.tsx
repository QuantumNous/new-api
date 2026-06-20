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

import { JsonViewer } from './json-viewer'
import type { GenerationDebugRaw } from './types'

interface RawDebugPanelProps {
  raw: GenerationDebugRaw
}

export function RawDebugPanel(props: RawDebugPanelProps) {
  const { t } = useTranslation()
  const entries = [
    [t('Inbound request'), props.raw.inbound_request],
    [t('Upstream request'), props.raw.upstream_request],
    [
      props.raw.raw_stream ? t('Raw stream') : t('Raw response'),
      props.raw.raw_stream ?? props.raw.raw_response,
    ],
  ] as const

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      {entries.map(
        ([label, value]) =>
          value && (
            <JsonViewer
              key={label}
              label={label}
              value={value.value}
              rawMeta={value}
              maxHeightClassName='h-[min(55dvh,560px)]'
            />
          )
      )}
    </div>
  )
}
