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

import type { MessageAttachment } from '../../types'

type PlaygroundMessageAttachmentsProps = {
  attachments: MessageAttachment[]
}

export function PlaygroundMessageAttachments(
  props: PlaygroundMessageAttachmentsProps
) {
  const { t } = useTranslation()

  if (props.attachments.length === 0) {
    return null
  }

  return (
    <div className='mb-2 flex flex-wrap gap-2'>
      {props.attachments.map((attachment) => (
        <a
          className='border-border/70 hover:border-primary/50 block overflow-hidden rounded-lg border'
          href={attachment.url}
          key={attachment.url}
          rel='noreferrer'
          target='_blank'
        >
          <img
            alt={attachment.filename || t('Attachment')}
            className='max-h-64 max-w-full object-contain'
            src={attachment.url}
          />
        </a>
      ))}
    </div>
  )
}
