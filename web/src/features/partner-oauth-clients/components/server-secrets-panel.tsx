/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useTranslation } from 'react-i18next'

import { BadgeCell } from '@/components/data-table/core/badge-cell'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestamp } from '@/lib/format'

import type {
  PartnerServerConfig,
  PartnerServerJobProgress,
  PartnerServerSecret,
} from '../types'

const MAX_ACTIVE_SECRETS = 2

function JobStatus(props: { label: string; job?: PartnerServerJobProgress }) {
  const { t, i18n } = useTranslation()
  if (!props.job || (!props.job.running && props.job.processed === 0)) {
    return null
  }
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const processed = formatNumber(props.job.processed, locale)
  let state = t('Finished, {{formatted}} sub-accounts processed', {
    formatted: processed,
  })
  if (props.job.running) {
    state = t('Running, {{formatted}} sub-accounts processed', {
      formatted: processed,
    })
  } else if (props.job.error) {
    state = t('Stopped early; run it again')
  }
  return (
    <p className='text-muted-foreground text-sm' role='status'>
      {props.label}: {state}
    </p>
  )
}

export function PartnerServerSecretsPanel(props: {
  config: PartnerServerConfig
  canWrite: boolean
  busy: boolean
  onIssue: () => void
  onRevoke: (secret: PartnerServerSecret) => void
  onRevokeAllKeys: () => void
}) {
  const { t } = useTranslation()
  const activeCount = props.config.secrets.filter(
    (secret) => secret.status === 'active'
  ).length
  const canIssue =
    props.canWrite &&
    props.config.configured &&
    activeCount < MAX_ACTIVE_SECRETS

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Up to two secrets can be active so the partner can switch without downtime. Each is shown once.'
          )}
        </p>
        {props.canWrite && (
          <Button
            type='button'
            size='sm'
            disabled={!canIssue || props.busy}
            onClick={props.onIssue}
          >
            {t('Issue secret')}
          </Button>
        )}
      </div>
      {!props.config.configured && (
        <p className='text-muted-foreground text-sm'>
          {t('Save the server access settings before issuing a secret.')}
        </p>
      )}
      <StaticDataTable
        data={props.config.secrets}
        getRowKey={(secret) => String(secret.id)}
        emptyContent={t('No server secrets yet.')}
        columns={[
          {
            id: 'id',
            header: t('ID'),
            cell: (secret) => secret.id,
          },
          {
            id: 'status',
            header: t('Status'),
            cell: (secret) => (
              <BadgeCell>
                <StatusBadge
                  label={
                    secret.status === 'active' ? t('Active') : t('Revoked')
                  }
                  variant={secret.status === 'active' ? 'success' : 'neutral'}
                  copyable={false}
                />
              </BadgeCell>
            ),
          },
          {
            id: 'created',
            header: t('Created'),
            cell: (secret) => formatTimestamp(secret.created_at),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-end',
            cell: (secret) =>
              props.canWrite && secret.status === 'active' ? (
                <Button
                  type='button'
                  size='sm'
                  variant='destructive'
                  disabled={props.busy}
                  onClick={() => props.onRevoke(secret)}
                >
                  {t('Revoke')}
                </Button>
              ) : null,
          },
        ]}
      />
      <div className='space-y-2 border-t pt-4'>
        <h3 className='text-sm font-medium'>{t('Emergency')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'If a server secret may have leaked, revoke it, then revoke every sub-account key. Balances stay; the partner rotates to get new keys.'
          )}
        </p>
        <JobStatus
          label={t('Key revocation')}
          job={props.config.jobs?.key_revocation}
        />
        <JobStatus
          label={t('Suspension')}
          job={props.config.jobs?.suspension}
        />
        {props.canWrite && (
          <Button
            type='button'
            size='sm'
            variant='destructive'
            disabled={props.busy || props.config.account_count === 0}
            onClick={props.onRevokeAllKeys}
          >
            {t('Revoke all sub-account keys')}
          </Button>
        )}
      </div>
    </div>
  )
}
