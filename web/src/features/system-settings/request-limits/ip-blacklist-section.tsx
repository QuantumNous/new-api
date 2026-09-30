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
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDateTimeStr } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { SettingsSection } from '../components/settings-section'

type IpBlacklistItem = {
  id: number
  ip: string
  reason: string
  hit_count: number
  created_at: number
}

type IpBlacklistPage = {
  items: IpBlacklistItem[]
  total: number
  page: number
  page_size: number
}

type ApiPageResponse = {
  success: boolean
  message?: string
  data?: IpBlacklistPage
}

async function fetchIpBlacklist(keyword: string, page: number) {
  const params = new URLSearchParams()
  params.set('p', String(page))
  params.set('page_size', '20')
  if (keyword.trim()) {
    params.set('keyword', keyword.trim())
  }
  const res = await api.get<ApiPageResponse>(
    `/api/ip-blacklist/?${params.toString()}`
  )
  const payload = requireServerSuccess(res.data)
  return (
    payload.data ?? {
      items: [],
      total: 0,
      page,
      page_size: 20,
    }
  )
}

async function deleteIpBlacklist(id: number) {
  const res = await api.delete(`/api/ip-blacklist/${id}`)
  return requireServerSuccess(res.data)
}

export function IpBlacklistSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pendingRemove, setPendingRemove] = useState<IpBlacklistItem | null>(
    null
  )

  const listQuery = useQuery({
    queryKey: ['ip-blacklist', search, page],
    queryFn: () => fetchIpBlacklist(search, page),
  })

  const removeMutation = useMutation({
    mutationFn: deleteIpBlacklist,
    onSuccess: async () => {
      toast.success(t('IP removed from blacklist'))
      setPendingRemove(null)
      await queryClient.invalidateQueries({ queryKey: ['ip-blacklist'] })
    },
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const pageSize = listQuery.data?.page_size ?? 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  let tableBody: ReactNode
  if (listQuery.isLoading) {
    tableBody = (
      <TableRow>
        <TableCell colSpan={5} className='text-muted-foreground'>
          {t('Loading...')}
        </TableCell>
      </TableRow>
    )
  } else if (items.length === 0) {
    tableBody = (
      <TableRow>
        <TableCell colSpan={5} className='text-muted-foreground'>
          {t('No blacklisted IPs')}
        </TableCell>
      </TableRow>
    )
  } else {
    tableBody = items.map((item) => (
      <TableRow key={item.id}>
        <TableCell className='font-mono'>{item.ip}</TableCell>
        <TableCell className='max-w-[20rem] truncate'>
          {item.reason || '—'}
        </TableCell>
        <TableCell>{item.hit_count}</TableCell>
        <TableCell>
          {item.created_at
            ? formatDateTimeStr(new Date(item.created_at * 1000))
            : '—'}
        </TableCell>
        <TableCell>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setPendingRemove(item)}
          >
            {t('Remove')}
          </Button>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <SettingsSection title={t('API Key IP Blacklist')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'IPs that exceed 10 invalid API key attempts within 24 hours are banned automatically. Only administrators can remove them.'
        )}
      </p>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          className='max-w-xs'
          placeholder={t('Search IP')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1)
              setSearch(keyword)
            }
          }}
        />
        <Button
          type='button'
          variant='secondary'
          onClick={() => {
            setPage(1)
            setSearch(keyword)
          }}
        >
          {t('Search')}
        </Button>
      </div>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('IP Address')}</TableHead>
              <TableHead>{t('Reason')}</TableHead>
              <TableHead>{t('Attempts')}</TableHead>
              <TableHead>{t('Banned At')}</TableHead>
              <TableHead className='w-[100px]'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </Table>
      </div>
      {totalPages > 1 ? (
        <div className='flex items-center justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('Previous')}
          </Button>
          <span className='text-muted-foreground text-sm'>
            {page} / {totalPages}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t('Next')}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null)
        }}
        title={t('Remove IP from blacklist?')}
        desc={t(
          'This IP will be allowed to call the API again. Repeated invalid key attempts can trigger another automatic ban.'
        )}
        confirmText={t('Remove')}
        destructive
        isLoading={removeMutation.isPending}
        handleConfirm={() => {
          if (pendingRemove) {
            removeMutation.mutate(pendingRemove.id)
          }
        }}
      />
    </SettingsSection>
  )
}
