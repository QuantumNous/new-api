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
import { LinkSquare02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { OFFICIAL_DOCUMENTATION_URL } from '@/lib/origins'
import { Button } from '@/components/ui/button'

type OperationDocumentationLinkProps = {
  size?: 'xs' | 'sm'
}

export function OperationDocumentationLink(
  props: OperationDocumentationLinkProps
) {
  const { t } = useTranslation()

  return (
    <Button
      size={props.size ?? 'sm'}
      className='shadow-primary/25 shadow-sm'
      render={
        <a
          href={OFFICIAL_DOCUMENTATION_URL}
          target='_blank'
          rel='noreferrer noopener'
        />
      }
    >
      {t('Operation documentation')}
      <HugeiconsIcon
        icon={LinkSquare02Icon}
        strokeWidth={2}
        data-icon='inline-end'
        aria-hidden='true'
      />
    </Button>
  )
}
