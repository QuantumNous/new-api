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
import { Link } from '@tanstack/react-router'
import { Trans, useTranslation } from 'react-i18next'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

/** Where request body passthrough is switched on for this channel. */
export type PassthroughHintScope = 'global' | 'channel' | 'route'

type PassthroughEffectiveHintProps = {
  /**
   * The switch that currently bypasses this setting, or `null` when none does.
   * A route-level switch only covers part of the traffic, so it is worded
   * differently from the global and channel switches.
   */
  scope: PassthroughHintScope | null
  /**
   * `paramOverride` also applies to embedding requests, which never take the
   * passthrough branch, so it needs the extra note.
   */
  kind?: 'body' | 'paramOverride'
}

const hintClassName = 'text-xs font-medium text-amber-700 dark:text-amber-400'

/**
 * Inline reminder for a setting the gateway cannot apply while request body
 * passthrough is on, so the effect stays visible after the enable
 * confirmation is dismissed.
 */
export function PassthroughEffectiveHint(props: PassthroughEffectiveHintProps) {
  const { t } = useTranslation()
  const isRoot = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )

  if (props.scope === null) {
    return null
  }

  const settingsLink = isRoot ? (
    <Link
      to='/system-settings/models/$section'
      params={{ section: 'global' }}
      className='underline underline-offset-4'
    />
  ) : (
    <span />
  )

  if (props.kind === 'paramOverride') {
    if (props.scope === 'route') {
      return (
        <span className={hintClassName}>
          {t(
            'Routes with request body passthrough on do not apply this setting; embedding and Alpha Search requests are unaffected'
          )}
        </span>
      )
    }

    if (props.scope === 'channel') {
      return (
        <span className={hintClassName}>
          {t(
            'Turn off request body passthrough for this setting to apply to chat requests; embedding and Alpha Search requests are unaffected'
          )}
        </span>
      )
    }

    return (
      <span className={hintClassName}>
        <Trans
          t={t}
          i18nKey='Turn off <settings>global request body passthrough</settings> for this setting to apply to chat requests; embedding and Alpha Search requests are unaffected'
          components={{ settings: settingsLink }}
        />
      </span>
    )
  }

  if (props.scope === 'route') {
    return (
      <span className={hintClassName}>
        {t(
          'This setting only applies to the routes without request body passthrough'
        )}
      </span>
    )
  }

  if (props.scope === 'channel') {
    return (
      <span className={hintClassName}>
        {t('Turn off request body passthrough for this setting to take effect')}
      </span>
    )
  }

  return (
    <span className={hintClassName}>
      <Trans
        t={t}
        i18nKey='Turn off <settings>global request body passthrough</settings> for this setting to take effect'
        components={{ settings: settingsLink }}
      />
    </span>
  )
}

/**
 * Inline reminder for model mapping, which keeps working through the upstream
 * URL but not through the request body once passthrough bypasses the body
 * rewrite. It is worded as a fact instead of naming a switch, because whether
 * the mapped model travels in the URL depends on the channel and the request.
 */
export function PassthroughModelMappingHint(props: {
  visible: boolean
  /** True when only some Advanced Custom routes take the passthrough branch. */
  routeScoped?: boolean
}) {
  const { t } = useTranslation()

  if (!props.visible) {
    return null
  }

  if (props.routeScoped) {
    return (
      <span className={hintClassName}>
        {t(
          'Routes with request body passthrough on skip the model name rewrite; requests whose upstream URL carries the model id, embedding requests, task requests and Alpha Search requests still apply the mapping'
        )}
      </span>
    )
  }

  return (
    <span className={hintClassName}>
      {t(
        'While request body passthrough is on, model mapping only applies to requests whose upstream URL carries the model id, plus embedding, task and Alpha Search requests'
      )}
    </span>
  )
}
