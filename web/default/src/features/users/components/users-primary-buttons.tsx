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
import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Download, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getUsers, searchUsers } from '../api'
import {
  USER_CONTACT_EXPORT_PAGE_SIZE,
  buildUserContactsCsv,
  collectUserContactsForExport,
  createUserContactsFilename,
} from '../lib/user-contact-export'
import { useUsers } from './users-provider'

const route = getRouteApi('/_authenticated/users/')

function downloadCsvFile(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 0)
}

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useUsers()
  const search = route.useSearch()
  const [isExportingContacts, setIsExportingContacts] = useState(false)

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }

  const handleExportContacts = async () => {
    const keyword = search.filter?.trim() ?? ''
    const group = search.group?.trim() ?? ''
    const role = search.role?.[0] ?? ''
    const status = search.status?.[0] ?? ''
    const hasFilters = Boolean(keyword || group || role || status)

    try {
      setIsExportingContacts(true)
      const users = await collectUserContactsForExport(
        async ({ page, pageSize }) => {
          const result = hasFilters
            ? await searchUsers({
                keyword,
                group,
                role,
                status,
                p: page,
                page_size: pageSize,
              })
            : await getUsers({ p: page, page_size: pageSize })

          if (!result.success) {
            throw new Error(
              result.message || t('Failed to export user contacts')
            )
          }

          return {
            items: result.data?.items ?? [],
            total: result.data?.total ?? 0,
          }
        },
        USER_CONTACT_EXPORT_PAGE_SIZE
      )

      if (users.length === 0) {
        toast.info(t('No users to export'))
        return
      }

      downloadCsvFile(
        buildUserContactsCsv(users, {
          id: t('ID'),
          username: t('Username'),
          displayName: t('Display Name'),
          quota: t('Quota'),
          email: t('Email'),
          wechatId: t('WeChat ID'),
          telegramId: t('Telegram ID'),
        }),
        createUserContactsFilename()
      )
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('Failed to export user contacts')
      )
    } finally {
      setIsExportingContacts(false)
    }
  }

  return (
    <div className='flex flex-wrap justify-end gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={handleExportContacts}
        disabled={isExportingContacts}
      >
        {isExportingContacts ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <Download className='h-4 w-4' />
        )}
        {t('Export Contacts')}
      </Button>
      <Button size='sm' onClick={handleCreate}>
        <Plus className='h-4 w-4' />
        {t('Add User')}
      </Button>
    </div>
  )
}
