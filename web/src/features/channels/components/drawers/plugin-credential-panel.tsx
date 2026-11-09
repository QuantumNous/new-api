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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { formatTimestampToDate } from '@/lib/format'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { getPluginCredentials } from '../../api'
import { channelsQueryKeys } from '../../lib'
import type { PluginCredentialSummary } from '../../lib/plugin-login'
import { MultiKeyManageDialog } from '../dialogs/multi-key-manage-dialog'

type PluginCredentialPanelProps = {
  /** Null until the channel is saved; login needs a channel id. */
  channelId: number | null
  multiKey: boolean
  disabled: boolean
  /**
   * null logs in a new credential; an index logs in again on that line. `add`
   * keeps the account of a single-key channel and adds the new one next to it.
   */
  onLogin: (keyIndex: number | null, add?: boolean) => void
}

/** Replaces the key input for plugins that log in to the provider. */
export function PluginCredentialPanel(props: PluginCredentialPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [manageKeysOpen, setManageKeysOpen] = useState(false)
  const channelId = props.channelId
  const query = useQuery({
    queryKey: channelsQueryKeys.pluginCredentials(channelId ?? 0),
    queryFn: () => getPluginCredentials(channelId ?? 0),
    enabled: channelId !== null,
    meta: { errorToast: false },
  })

  if (channelId === null) {
    return (
      <div className='flex flex-col gap-1.5'>
        <p className='text-sm font-medium'>{t('Credentials')}</p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'This channel signs in with a provider account. Save the channel, then log in.'
          )}
        </p>
      </div>
    )
  }

  const items = query.data ?? []
  const loggedIn = items.length > 0
  // A single-key channel replaces its account, or adds one and becomes a
  // multi-key channel.
  const canSwitch = loggedIn && !props.multiKey
  const LoginIcon = loggedIn ? UserPlus : LogIn

  let list
  if (query.isPending) {
    list = <LoadingState inline size='sm' />
  } else if (query.isError) {
    list = (
      <ErrorState
        title={t('Failed to load credentials')}
        description={getServerErrorMessage(query.error)}
        onRetry={() => void query.refetch()}
        className='min-h-0 border p-4'
      />
    )
  } else if (items.length === 0) {
    list = (
      <EmptyState
        icon={KeyRound}
        title={t('Not logged in')}
        description={t('Log in to start using this channel.')}
        bordered
        className='min-h-0 p-4'
      />
    )
  } else {
    list = (
      <ItemGroup className='gap-2'>
        {items.map((item) => (
          <CredentialRow
            key={item.index}
            item={item}
            multiKey={props.multiKey}
            disabled={props.disabled}
            onLogin={() => props.onLogin(item.index)}
          />
        ))}
      </ItemGroup>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-medium'>{t('Credentials')}</p>
        <div className='flex flex-wrap items-center gap-2'>
          {props.multiKey && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setManageKeysOpen(true)}
            >
              {t('Manage Keys')}
            </Button>
          )}
          {canSwitch && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={props.disabled}
              onClick={() => props.onLogin(null)}
            >
              <LogIn data-icon='inline-start' />
              {t('Switch account')}
            </Button>
          )}
          <Button
            type='button'
            size='sm'
            disabled={props.disabled || query.isPending}
            onClick={() => props.onLogin(null, canSwitch)}
          >
            <LoginIcon data-icon='inline-start' />
            {loggedIn ? t('Add account') : t('Log in')}
          </Button>
        </div>
      </div>
      {list}
      {props.multiKey && (
        <MultiKeyManageDialog
          open={manageKeysOpen}
          onOpenChange={(open) => {
            setManageKeysOpen(open)
            if (!open) {
              void queryClient.invalidateQueries({
                queryKey: channelsQueryKeys.pluginCredentials(channelId),
              })
            }
          }}
        />
      )}
    </div>
  )
}

function CredentialRow(props: {
  item: PluginCredentialSummary
  multiKey: boolean
  disabled: boolean
  onLogin: () => void
}) {
  const { t } = useTranslation()
  const item = props.item
  const name = item.label || item.account_id || t('Unnamed account')
  const details: string[] = []
  if (item.account_id && item.account_id !== name) {
    details.push(`${t('Account ID')}: ${item.account_id}`)
  }
  if (item.expires_at) {
    details.push(
      t('Expires {{time}}', { time: formatTimestampToDate(item.expires_at) })
    )
  }
  return (
    <Item variant='outline' size='sm'>
      <ItemContent className='min-w-0'>
        <ItemTitle className='flex min-w-0 flex-wrap items-center gap-2'>
          {/* Same numbering as the multi-key manager, which removes lines. */}
          {props.multiKey && (
            <span className='text-muted-foreground tabular-nums'>
              #{item.index + 1}
            </span>
          )}
          <span className='min-w-0 break-all'>{name}</span>
          {item.needs_login && (
            <StatusBadge
              label={t('Needs login')}
              variant='warning'
              copyable={false}
            />
          )}
        </ItemTitle>
        {details.length > 0 && (
          <ItemDescription className='break-all'>
            {details.join(' · ')}
          </ItemDescription>
        )}
      </ItemContent>
      <ItemActions>
        <Button
          type='button'
          variant={item.needs_login ? 'default' : 'outline'}
          size='sm'
          disabled={props.disabled}
          onClick={props.onLogin}
        >
          {t('Log in again')}
        </Button>
      </ItemActions>
    </Item>
  )
}
