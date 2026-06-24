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
import type { MouseEventHandler } from 'react'
import {
  ArrowRight,
  Download,
  Eye,
  LockKeyhole,
  Play,
  RefreshCcw,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { SkillCTAAction } from '../types'

interface SkillCTAProps {
  action: SkillCTAAction
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
}

const ctaConfig = {
  view: { icon: Eye, label: 'View', variant: 'outline' },
  download: { icon: Download, label: 'Download', variant: 'default' },
  enable: { icon: Sparkles, label: 'Enable', variant: 'default' },
  use: { icon: Play, label: 'Use', variant: 'default' },
  upgrade: { icon: Zap, label: 'Upgrade', variant: 'default' },
  renew: { icon: RefreshCcw, label: 'Renew', variant: 'default' },
  contact_sales: {
    icon: UsersRound,
    label: 'Contact Sales',
    variant: 'outline',
  },
  login: { icon: UserRound, label: 'Log in', variant: 'outline' },
  remove: {
    icon: Trash2,
    label: 'Remove from My Skills',
    variant: 'destructive',
  },
  unavailable: {
    icon: LockKeyhole,
    label: 'Unavailable',
    variant: 'secondary',
  },
} as const

export function SkillCTA({ action, disabled, onClick }: SkillCTAProps) {
  const { t } = useTranslation()
  const normalizedAction = action in ctaConfig ? action : 'view'
  const config = ctaConfig[normalizedAction]
  const Icon = config.icon
  const isUnavailable = normalizedAction === 'unavailable'

  return (
    <Button
      type='button'
      size='sm'
      variant={config.variant}
      className='min-w-28'
      disabled={disabled || isUnavailable}
      aria-disabled={disabled || isUnavailable}
      onClick={onClick}
    >
      <Icon data-icon='inline-start' />
      {t(config.label)}
      {normalizedAction === 'view' && <ArrowRight data-icon='inline-end' />}
    </Button>
  )
}
