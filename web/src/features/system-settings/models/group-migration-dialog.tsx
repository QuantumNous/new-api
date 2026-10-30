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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toIntlLocale } from '@/i18n/languages'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import {
  createGroupMigrationSchema,
  type GroupMigrationNames,
} from '../lib/group-migration-schema'

type GroupMigrationPreview = {
  source: string
  target: string
  version: string
  counts: Record<string, { records: number; references: number }>
  unfinished_tasks: number
  blockers: string[]
  warnings: string[]
}

export function GroupMigrationEntry() {
  const { t } = useTranslation()
  const isRoot = useAuthStore((state) => (state.auth.user?.role ?? 0) >= 100)
  const [open, setOpen] = useState(false)
  if (!isRoot) return null
  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => setOpen(true)}
      >
        {t('Group migration')}
      </Button>
      {open && <GroupMigrationDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function GroupMigrationDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const form = useForm<GroupMigrationNames>({
    resolver: zodResolver(createGroupMigrationSchema(t)),
    defaultValues: { source: '', target: '' },
  })
  const source = form.watch('source')
  const target = form.watch('target')
  const groups = useQuery({
    queryKey: ['group-migration', 'groups'],
    queryFn: async ({ signal }) => {
      const response = await api.get<{ success: boolean; data: string[] }>(
        '/api/group/',
        { signal, skipErrorHandler: true }
      )
      return requireServerSuccess(response.data).data
    },
    staleTime: 0,
    retry: false,
    meta: { errorToast: false },
  })
  const preview = useMutation({
    meta: { errorToast: false },
    mutationFn: async (names: GroupMigrationNames) => {
      const response = await api.get<{
        success: boolean
        data: GroupMigrationPreview
      }>('/api/option/group_migration/preview', {
        params: names,
        skipErrorHandler: true,
      })
      return requireServerSuccess(response.data).data
    },
  })
  // A pending result belongs to its submitted names, never the current draft.
  const result =
    preview.data?.source === source && preview.data.target === target
      ? preview.data
      : undefined
  const error =
    groups.isError ||
    (preview.isError &&
      preview.variables?.source === source &&
      preview.variables.target === target)
  const categories = {
    users: t('Users'),
    tokens: t('Tokens'),
    channels: t('Channels'),
    abilities: t('Routing abilities'),
    subscription_plans: t('Subscription plans'),
    subscriptions: t('Subscriptions'),
    configuration: t('Effective configuration'),
    saved_configuration: t('Saved configuration'),
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t('Group migration')}
      description={t(
        'Preview group references before migration. No data will be changed.'
      )}
    >
      <Form {...form}>
        <form
          className='flex flex-col gap-4'
          noValidate
          onSubmit={form.handleSubmit((names) => preview.mutate(names))}
        >
          <FormField
            control={form.control}
            name='source'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Source group')}</FormLabel>
                <FormControl>
                  <NativeSelect
                    {...field}
                    required
                    disabled={groups.isPending || groups.isError}
                  >
                    <NativeSelectOption value=''>
                      {t('Select a group')}
                    </NativeSelectOption>
                    {(groups.data ?? [])
                      .filter(
                        (group) => group !== 'default' && group !== 'auto'
                      )
                      .sort()
                      .map((group) => (
                        <NativeSelectOption key={group} value={group}>
                          {group}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='target'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Target group name')}</FormLabel>
                <FormControl>
                  <Input {...field} required autoComplete='off' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {groups.isPending && (
            <div role='status'>
              <LoadingState inline message={t('Loading...')} />
            </div>
          )}
          {groups.isSuccess &&
            !(groups.data ?? []).some(
              (group) => group !== 'default' && group !== 'auto'
            ) && (
              <EmptyState
                className='min-h-0'
                title={t('No groups are available for migration.')}
              />
            )}
          {error && (
            <div role='alert'>
              <ErrorState
                className='min-h-0'
                title={t(
                  'Unable to inspect group references. Please try again.'
                )}
                onRetry={
                  groups.isError ? () => void groups.refetch() : undefined
                }
              />
            </div>
          )}
          <Button
            type='submit'
            disabled={
              !source || !target || preview.isPending || !groups.isSuccess
            }
          >
            {preview.isPending ? t('Loading...') : t('Preview impact')}
          </Button>
        </form>
      </Form>
      {result && (
        <section className='mt-4 flex flex-col gap-3' aria-live='polite'>
          <p className='text-sm'>
            {result.source} → {result.target}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Resource')}</TableHead>
                <TableHead>{t('Records')}</TableHead>
                <TableHead>{t('References')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(categories).map(([key, label]) => (
                <TableRow key={key}>
                  <TableCell>{label}</TableCell>
                  <TableCell>
                    {formatNumber(result.counts[key]?.records ?? 0, locale)}
                  </TableCell>
                  <TableCell>
                    {formatNumber(result.counts[key]?.references ?? 0, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Configuration rows count effective settings and saved options separately.'
            )}
          </p>
          <p>
            {t('Related unfinished tasks')}:{' '}
            {formatNumber(result.unfinished_tasks, locale)}
          </p>
          {result.blockers.length === 0 ? (
            <p>
              {t(
                'No blocking conditions found. Execution is not available yet.'
              )}
            </p>
          ) : (
            <ul className='text-destructive flex list-disc flex-col gap-1 pl-5'>
              {result.blockers.map((message) => (
                <li key={message}>{t(message)}</li>
              ))}
            </ul>
          )}
          <ul className='text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm'>
            {result.warnings.map((message) => (
              <li key={message}>{t(message)}</li>
            ))}
          </ul>
          <p className='text-muted-foreground text-xs break-all'>
            {t('Preview version')}: <span>{result.version}</span>
          </p>
        </section>
      )}
      <div className='mt-4 flex flex-wrap justify-end gap-2'>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('Close')}
        </Button>
        <Button type='button' disabled>
          {t('Migration execution is not available yet')}
        </Button>
      </div>
    </Dialog>
  )
}
