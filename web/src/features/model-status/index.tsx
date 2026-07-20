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

import { PublicLayout } from '@/components/layout'

// Same-origin reverse proxy under newapi.toyhunter.site (nginx /tools-embed/* ->
// tools :1145). Avoids Cloudflare X-Frame-Options / bot challenge on the
// standalone tools domain, which would blank the iframe.
const EMBED_URL = '/tools-embed/embed.html'

export function ModelStatus() {
  const { t } = useTranslation()

  return (
    <PublicLayout showMainContainer={false}>
      {/* Fill the viewport below the fixed 64px public header. */}
      <div className='h-[calc(100svh-4rem)] w-full pt-16'>
        {/*
          No sandbox: the iframe is same-origin via nginx /tools-embed reverse
          proxy, and the tools page needs real same-origin fetch/localStorage
          against /api/model-status and /api/embed. Content is our own first-party
          tools service.
        */}
        {/* oxlint-disable-next-line react/iframe-missing-sandbox -- first-party same-origin tools embed needs unrestricted frame */}
        <iframe
          src={EMBED_URL}
          title={t('Model Status')}
          className='h-full w-full border-0'
          loading='lazy'
        />
      </div>
    </PublicLayout>
  )
}
