import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useStatus } from '@/hooks/use-status'
import type { SystemStatus } from '@/features/auth/types'

function extractServerAddress(status: SystemStatus | null) {
  const fromStatus =
    (status?.server_address as string | undefined) ??
    (status?.serverAddress as string | undefined) ??
    status?.data?.server_address ??
    (status?.data as Record<string, unknown> | undefined)?.serverAddress

  if (typeof fromStatus === 'string' && fromStatus.trim()) {
    return fromStatus.trim()
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return ''
}

function normalizeRequestUrl(serverAddress: string) {
  const normalized = serverAddress.replace(/\/+$/, '')
  if (!normalized) {
    return ''
  }
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`
}

export function ApiRequestUrlCard() {
  const { t } = useTranslation()
  const { status } = useStatus()

  const apiRequestUrl = useMemo(() => {
    return normalizeRequestUrl(extractServerAddress(status))
  }, [status])

  return (
    <Card className='gap-0 py-4'>
      <CardContent className='px-4 sm:px-6'>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='secondary'>{t('OpenAI')}</Badge>
            <p className='text-sm font-medium'>{t('API Request URL')}</p>
          </div>

          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input
              readOnly
              value={apiRequestUrl}
              onFocus={(event) => event.currentTarget.select()}
              aria-label={t('API Request URL')}
              className='font-mono text-xs sm:text-sm'
            />
            <CopyButton
              value={apiRequestUrl}
              variant='outline'
              size='default'
              className='w-full sm:w-auto'
              iconClassName='size-4'
              tooltip={t('Copy URL')}
              aria-label={t('Copy API request URL')}
            >
              <span className='ml-1'>{t('Copy')}</span>
            </CopyButton>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
