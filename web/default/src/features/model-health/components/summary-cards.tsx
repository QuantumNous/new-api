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
  PackageIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatInteger, formatPercent } from '../lib'
import type { ModelHealthFleet } from '../types'

type SummaryCardProps = {
  icon: typeof PackageIcon
  label: string
  value: string
  detail: string
}

function SummaryCard(props: SummaryCardProps) {
  return (
    <Card className='min-w-0 gap-3 py-4'>
      <CardHeader className='gap-1 px-4'>
        <CardDescription className='flex items-center gap-2'>
          <HugeiconsIcon icon={props.icon} strokeWidth={2} aria-hidden='true' />
          {props.label}
        </CardDescription>
        <CardTitle className='font-mono text-2xl tabular-nums'>
          {props.value}
        </CardTitle>
      </CardHeader>
      <CardContent className='text-muted-foreground px-4 text-xs'>
        {props.detail}
      </CardContent>
    </Card>
  )
}

export function SummaryCards(props: { fleet: ModelHealthFleet }) {
  const { t } = useTranslation()
  const attentionCount = props.fleet.degraded_models + props.fleet.watch_models

  return (
    <section
      className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
      aria-label={t('Fleet summary')}
    >
      <SummaryCard
        icon={CheckmarkCircle02Icon}
        label={t('Weighted observed success')}
        value={t('{{value}}%', {
          value: formatPercent(props.fleet.success_rate),
        })}
        detail={t('{{success}} successful final requests', {
          success: formatInteger(props.fleet.success_count),
        })}
      />
      <SummaryCard
        icon={PackageIcon}
        label={t('Final requests')}
        value={formatInteger(props.fleet.request_count)}
        detail={t('Across {{count}} observed models', {
          count: formatInteger(props.fleet.model_count),
        })}
      />
      <SummaryCard
        icon={InformationCircleIcon}
        label={t('Healthy sampled models')}
        value={t('{{healthy}} / {{sampled}}', {
          healthy: formatInteger(props.fleet.healthy_models),
          sampled: formatInteger(props.fleet.sufficiently_sampled_models),
        })}
        detail={t('Healthy among sufficiently sampled models')}
      />
      <SummaryCard
        icon={Alert02Icon}
        label={t('Models needing attention')}
        value={formatInteger(attentionCount)}
        detail={t('{{degraded}} degraded · {{watch}} watch', {
          degraded: formatInteger(props.fleet.degraded_models),
          watch: formatInteger(props.fleet.watch_models),
        })}
      />
    </section>
  )
}
