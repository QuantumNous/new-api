/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { healthLabelKey } from '../lib'
import type { ModelHealthState } from '../types'

const STATUS_CONFIG = {
  healthy: { icon: CheckmarkCircle02Icon, variant: 'default' },
  watch: { icon: Alert02Icon, variant: 'outline' },
  degraded: { icon: Alert02Icon, variant: 'destructive' },
  insufficient: { icon: InformationCircleIcon, variant: 'secondary' },
} as const

export function HealthBadge(props: { state: ModelHealthState }) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[props.state]

  return (
    <Badge variant={config.variant}>
      <HugeiconsIcon
        icon={config.icon}
        strokeWidth={2}
        data-icon='inline-start'
        aria-hidden='true'
      />
      {t(healthLabelKey(props.state))}
    </Badge>
  )
}
