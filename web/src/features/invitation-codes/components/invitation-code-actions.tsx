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
import { Ban, CheckCircle2, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  INVITATION_CODE_STATE_META,
  getInvitationCodeState,
} from '../constants'
import type { InvitationCode } from '../types'

type IconActionProps = {
  label: string
  icon: ReactNode
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

function IconAction(props: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            size='icon-sm'
            variant={props.destructive ? 'ghost' : 'outline'}
            className={props.destructive ? 'text-destructive' : undefined}
            aria-label={props.label}
            onClick={props.onClick}
            disabled={props.disabled}
          />
        }
      >
        {props.icon}
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}

type InvitationCodeActionsProps = {
  invitationCode: InvitationCode
  isUpdating: boolean
  onStatusChange: (invitationCode: InvitationCode) => void
  onDelete: (invitationCode: InvitationCode) => void
}

export function InvitationCodeActions(props: InvitationCodeActionsProps) {
  const { t } = useTranslation()
  const state = getInvitationCodeState(props.invitationCode)
  const canChangeStatus = state === 'enabled' || state === 'disabled'
  const isEnabled = state === 'enabled'

  return (
    <div className='flex items-center justify-end gap-1.5'>
      {canChangeStatus ? (
        <IconAction
          label={isEnabled ? t('Disable') : t('Enable')}
          icon={
            isEnabled ? (
              <Ban className='size-4' />
            ) : (
              <CheckCircle2 className='size-4' />
            )
          }
          onClick={() => props.onStatusChange(props.invitationCode)}
          disabled={props.isUpdating}
        />
      ) : null}
      <IconAction
        label={t('Delete')}
        icon={<Trash2 className='size-4' />}
        onClick={() => props.onDelete(props.invitationCode)}
        destructive
      />
    </div>
  )
}

export function InvitationStatus(props: { invitationCode: InvitationCode }) {
  const { t } = useTranslation()
  const state = getInvitationCodeState(props.invitationCode)
  const meta = INVITATION_CODE_STATE_META[state]
  return (
    <StatusBadge
      label={t(meta.labelKey)}
      variant={meta.variant}
      copyable={false}
    />
  )
}
