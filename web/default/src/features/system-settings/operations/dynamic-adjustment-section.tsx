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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getChannelDynamicLogs,
  getChannelDynamicOverrides,
  getChannelDynamicProbes,
  getChannelDynamicSettings,
  updateChannelDynamicSettings,
} from '../api'
import { SettingsSection } from '../components/settings-section'
import type {
  ChannelDynamicLog,
  ChannelDynamicOverride,
  ChannelProbeResult,
} from '../types'
import { DynamicAdjustmentSettingsForm } from './dynamic-adjustment-settings-form'
import { isDynamicSettingsFormDisabled } from './dynamic-adjustment-settings'

function formatTime(timestamp?: number) {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

function stateBadge(state: string) {
  const variant = state === 'unhealthy' ? 'destructive' : 'secondary'
  return <Badge variant={variant}>{state || '-'}</Badge>
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation()
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className='text-muted-foreground py-6'>
        {t('No dynamic adjustment data yet')}
      </TableCell>
    </TableRow>
  )
}

function OverridesTable({ rows }: { rows: ChannelDynamicOverride[] }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Channel')}</TableHead>
          <TableHead>{t('Model')}</TableHead>
          <TableHead>{t('State')}</TableHead>
          <TableHead>{t('Weight')}</TableHead>
          <TableHead>{t('Dry-run')}</TableHead>
          <TableHead>{t('Updated')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <EmptyRow colSpan={6} />}
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.channel_id}</TableCell>
            <TableCell>{row.model}</TableCell>
            <TableCell>{stateBadge(row.state)}</TableCell>
            <TableCell>{row.applied_weight}</TableCell>
            <TableCell>{row.dry_run ? t('Yes') : t('No')}</TableCell>
            <TableCell>{formatTime(row.updated_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function LogsTable({ rows }: { rows: ChannelDynamicLog[] }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Channel')}</TableHead>
          <TableHead>{t('Model')}</TableHead>
          <TableHead>{t('Action')}</TableHead>
          <TableHead>{t('Protected')}</TableHead>
          <TableHead>{t('Reason')}</TableHead>
          <TableHead>{t('Created')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <EmptyRow colSpan={6} />}
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.channel_id}</TableCell>
            <TableCell>{row.model}</TableCell>
            <TableCell>{row.action}</TableCell>
            <TableCell>{row.protected ? t('Yes') : t('No')}</TableCell>
            <TableCell className='max-w-72 truncate'>{row.reason}</TableCell>
            <TableCell>{formatTime(row.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProbesTable({ rows }: { rows: ChannelProbeResult[] }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Channel')}</TableHead>
          <TableHead>{t('Model')}</TableHead>
          <TableHead>{t('Probe')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead>{t('Latency')}</TableHead>
          <TableHead>{t('Checked')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <EmptyRow colSpan={6} />}
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.channel_id}</TableCell>
            <TableCell>{row.model}</TableCell>
            <TableCell>{row.probe_type}</TableCell>
            <TableCell>{stateBadge(row.status)}</TableCell>
            <TableCell>{row.latency}ms</TableCell>
            <TableCell>{formatTime(row.checked_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function DynamicAdjustmentSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['channel-dynamic-settings'],
    queryFn: getChannelDynamicSettings,
  })
  const overridesQuery = useQuery({
    queryKey: ['channel-dynamic-overrides'],
    queryFn: getChannelDynamicOverrides,
  })
  const logsQuery = useQuery({
    queryKey: ['channel-dynamic-logs'],
    queryFn: getChannelDynamicLogs,
  })
  const probesQuery = useQuery({
    queryKey: ['channel-dynamic-probes'],
    queryFn: getChannelDynamicProbes,
  })

  const updateSettings = useMutation({
    mutationFn: updateChannelDynamicSettings,
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to update setting'))
        return
      }
      toast.success(t('Setting updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['channel-dynamic-settings'] })
    },
    onError: () => {
      toast.error(t('Failed to update setting'))
    },
  })

  const settings = settingsQuery.data?.data

  return (
    <SettingsSection
      title={t('Dynamic channel adjustment')}
      description={t(
        'Control dry-run mode and inspect automatic channel adjustment data.'
      )}
    >
      <DynamicAdjustmentSettingsForm
        settings={settings}
        disabled={isDynamicSettingsFormDisabled({
          loading: settingsQuery.isLoading,
        })}
        saving={updateSettings.isPending}
        onSave={async (updates) => {
          if (Object.keys(updates).length === 0) {
            toast.info(t('No changes to save'))
            return
          }
          await updateSettings.mutateAsync(updates)
        }}
      />

      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground text-sm'>
          {t('Showing the latest records. Use API filters for deeper audits.')}
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => {
            queryClient.invalidateQueries({
              queryKey: ['channel-dynamic-overrides'],
            })
            queryClient.invalidateQueries({
              queryKey: ['channel-dynamic-logs'],
            })
            queryClient.invalidateQueries({
              queryKey: ['channel-dynamic-probes'],
            })
          }}
        >
          {t('Refresh')}
        </Button>
      </div>

      <div className='space-y-6'>
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>{t('Current overrides')}</h4>
          <OverridesTable rows={overridesQuery.data?.data ?? []} />
        </div>
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>{t('Adjustment logs')}</h4>
          <LogsTable rows={logsQuery.data?.data ?? []} />
        </div>
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>{t('Probe results')}</h4>
          <ProbesTable rows={probesQuery.data?.data ?? []} />
        </div>
      </div>
    </SettingsSection>
  )
}
