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

import { Badge } from '@/components/ui/badge'

/**
 * Tags for the parts of a plugin: the task part, the model provider part, an
 * account sign-in in place of a key, and request processing. Lists split by
 * kind leave out the tag of the kind being shown.
 */
export function PluginPartsBadges(props: {
  task?: boolean
  provider?: boolean
  login?: boolean
  transform?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      {props.task && <Badge variant='outline'>{t('Task')}</Badge>}
      {props.provider && <Badge variant='outline'>{t('Channel')}</Badge>}
      {props.login && <Badge variant='outline'>{t('Account login')}</Badge>}
      {props.transform && (
        <Badge variant='outline'>{t('Request processing')}</Badge>
      )}
    </>
  )
}
