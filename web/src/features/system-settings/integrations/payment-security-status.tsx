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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

interface SecurityStatus {
  key_file_status: 'unconfigured' | 'ready' | 'error'
  active_key_id?: string
  migration_enabled: boolean
  alipay: 'unknown' | 'empty' | 'verified' | 'error'
  wechatpay: 'unknown' | 'empty' | 'verified' | 'error'
}

export function PaymentSecurityStatus() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['payment-security'],
    queryFn: async () =>
      requireServerSuccess(
        (
          await api.get<{ success: boolean; data: SecurityStatus }>(
            '/api/option/payment-security'
          )
        ).data
      ).data,
    staleTime: 0,
    retry: false,
    meta: { errorToast: false },
  })
  const labels = {
    unconfigured: t('Not configured'),
    ready: t('Ready'),
    error: t('Verification failed'),
    unknown: t('Not checked'),
    empty: t('No stored credentials'),
    verified: t('Encrypted and verified'),
  }
  const status = query.data

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Payment security')}</CardTitle>
        <CardDescription>
          {t(
            'Checks stored Alipay and WeChat Pay credentials, including historical configurations. Other gateways are not covered.'
          )}
        </CardDescription>
        <CardAction>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('Refresh')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className='space-y-4'>
        {query.isPending && <LoadingState className='min-h-20' />}
        {query.isError && (
          <ErrorState
            className='min-h-20'
            title={t('Unable to check payment security')}
            onRetry={() => void query.refetch()}
          />
        )}
        {!query.isError && status && (
          <>
            <dl className='grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4'>
              <div>
                <dt className='text-muted-foreground mb-2'>
                  {t('Encryption key file')}
                </dt>
                <dd>
                  <Badge
                    variant={
                      status.key_file_status === 'ready'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {labels[status.key_file_status]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground mb-2'>
                  {t('Active key ID')}
                </dt>
                <dd className='font-mono break-all'>
                  {status.active_key_id || '—'}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground mb-2'>{t('Alipay')}</dt>
                <dd>
                  <Badge
                    variant={
                      status.alipay === 'error' ? 'destructive' : 'secondary'
                    }
                  >
                    {labels[status.alipay]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground mb-2'>
                  {t('WeChat Pay')}
                </dt>
                <dd>
                  <Badge
                    variant={
                      status.wechatpay === 'error' ? 'destructive' : 'secondary'
                    }
                  >
                    {labels[status.wechatpay]}
                  </Badge>
                </dd>
              </div>
            </dl>
            {status.migration_enabled && (
              <p role='alert' className='text-destructive text-sm'>
                {t(
                  'Migration mode is enabled. Disable it on the server after migration.'
                )}
              </p>
            )}
            {(status.key_file_status !== 'ready' ||
              status.alipay === 'error' ||
              status.wechatpay === 'error') && (
              <p role='alert' className='text-destructive text-sm'>
                {t(
                  'Ask the server operator to check the payment key file and credential migration.'
                )}
              </p>
            )}
          </>
        )}
        <p className='text-muted-foreground text-xs'>
          {t(
            'AES-256-GCM with a separate server key file. Key generation, rotation and backups are managed on the server; key contents are never displayed here.'
          )}
        </p>
      </CardContent>
    </Card>
  )
}
