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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import { createApiKey } from '@/features/keys/api'
import { buildDefaultApiKeyPayload } from '@/features/keys/lib/auto-create-api-key'
import type { ApiKey } from '@/features/keys/types'

function formatKeyDate(createdTime?: number): string {
  if (!createdTime) return ''
  return new Date(createdTime * 1000).toLocaleDateString()
}

export function ApiKeyPicker(props: {
  keys: ApiKey[]
  loading: boolean
  selectedKeyId: number | null
  resolvedKeys: Record<number, string>
  onSelect: (keyId: number) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await createApiKey(
        buildDefaultApiKeyPayload({ name: 'default' })
      )
      if (!result.success) {
        throw new Error(result.message || t('Failed to create API key'))
      }
      return result.data
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', 'overview', 'api-keys'],
      })
      if (created?.id) {
        props.onSelect(created.id)
      }
      toast.success(t('API key created'))
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className='bg-muted/30 flex flex-col gap-3 rounded-xl border p-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='flex flex-col gap-0.5'>
          <span className='text-sm font-semibold'>{t('API keys')}</span>
          <span className='text-muted-foreground text-xs'>
            {t(
              'Create a key to authenticate requests, or choose one of your recent keys.'
            )}
          </span>
        </div>
        <Button
          size='sm'
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Plus data-icon='inline-start' />
          {t('Create API key')}
        </Button>
      </div>

      {props.loading ? (
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-11 w-full rounded-lg' />
          <Skeleton className='h-11 w-full rounded-lg' />
        </div>
      ) : props.keys.length === 0 ? (
        <p className='text-muted-foreground py-2 text-sm'>
          {t('No API key yet. Create one to get a ready-to-run example.')}
        </p>
      ) : (
        <div className='flex flex-col gap-1.5'>
          {props.keys.map((key) => {
            const selected = key.id === props.selectedKeyId
            const fullKey = props.resolvedKeys[key.id]

            return (
              <div
                key={key.id}
                className={cn(
                  'bg-background flex items-center gap-3 rounded-lg border px-3 py-2',
                  selected && 'border-primary ring-primary/30 ring-1'
                )}
              >
                <button
                  type='button'
                  onClick={() => props.onSelect(key.id)}
                  className='flex min-w-0 flex-1 items-center gap-3 text-left'
                  aria-pressed={selected}
                >
                  <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                    {`sk-${key.key}`}
                  </span>
                  <span className='text-muted-foreground hidden min-w-0 flex-1 truncate text-xs sm:block'>
                    {key.name}
                  </span>
                  <span className='text-muted-foreground hidden shrink-0 text-xs md:block'>
                    {formatKeyDate(key.created_time)}
                  </span>
                </button>
                {fullKey ? (
                  <CopyButton
                    value={fullKey}
                    className='size-7'
                    iconClassName='size-3.5'
                    tooltip={t('Copy API key')}
                    successTooltip={t('Copied!')}
                    aria-label={t('Copy API key')}
                  />
                ) : (
                  <Loader2
                    className='text-muted-foreground size-3.5 shrink-0 animate-spin'
                    aria-label={t('Loading...')}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
