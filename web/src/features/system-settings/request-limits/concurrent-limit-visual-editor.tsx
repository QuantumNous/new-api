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
import { Plus, Search } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isObjectRecord } from '../utils/json-validators'
import {
  ConcurrentLimitDialog,
  type ConcurrentLimitEntryData,
} from './concurrent-limit-dialog'

type ConcurrentLimitVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

type ConcurrentLimitEntry = ConcurrentLimitEntryData

export function ConcurrentLimitVisualEditor({
  value,
  onChange,
}: ConcurrentLimitVisualEditorProps) {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<ConcurrentLimitEntry | null>(null)

  const concurrentLimits = useMemo(() => {
    if (!value || value.trim() === '') return []

    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      validatorMessage: 'Concurrent limits must be a JSON object',
      context: 'concurrent limits',
    })

    return Object.entries(parsed)
      .map(([groupName, limit]) => {
        if (typeof limit === 'number') {
          return {
            groupName,
            maxConcurrent: limit,
          }
        }
        return null
      })
      .filter((item): item is ConcurrentLimitEntry => item !== null)
  }, [value])

  const filteredLimits = useMemo(() => {
    if (!searchText) return concurrentLimits
    const lowerSearch = searchText.toLowerCase()
    return concurrentLimits.filter((limit) =>
      limit.groupName.toLowerCase().includes(lowerSearch)
    )
  }, [concurrentLimits, searchText])

  const handleSave = (data: ConcurrentLimitEntryData) => {
    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      silent: true,
    })

    if (editData && editData.groupName !== data.groupName) {
      delete parsed[editData.groupName]
    }

    parsed[data.groupName] = data.maxConcurrent

    onChange(JSON.stringify(parsed, null, 2))
  }

  const handleDelete = (groupName: string) => {
    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      silent: true,
    })

    delete parsed[groupName]

    onChange(JSON.stringify(parsed, null, 2))
  }

  const handleEdit = (limit: ConcurrentLimitEntry) => {
    setEditData(limit)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditData(null)
    setDialogOpen(true)
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-4'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
          <Input
            placeholder={t('Search group names...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className='pl-9'
          />
        </div>
        <Button onClick={handleAdd}>
          <Plus className='mr-2 h-4 w-4' />
          {t('Add group')}
        </Button>
      </div>

      <StaticDataTable
        data={filteredLimits}
        getRowKey={(limit) => limit.groupName}
        emptyContent={
          searchText
            ? t('No groups match your search')
            : t(
                'No group-based concurrent limits configured. Click "Add group" to get started.'
              )
        }
        columns={[
          {
            id: 'group',
            header: t('Group Name'),
            cellClassName: 'font-medium',
            cell: (limit) => limit.groupName,
          },
          {
            id: 'max-concurrent',
            header: t('Max Concurrent'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (limit) => (
              <span className='font-mono'>
                {limit.maxConcurrent === 0
                  ? t('Unlimited')
                  : limit.maxConcurrent.toLocaleString()}
              </span>
            ),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (limit) => (
              <StaticRowActions
                editLabel={t('Edit')}
                deleteLabel={t('Delete')}
                menuLabel={t('Open menu')}
                onEdit={() => handleEdit(limit)}
                onDelete={() => handleDelete(limit.groupName)}
              />
            ),
          },
        ]}
      />

      <ConcurrentLimitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editData={editData}
      />
    </div>
  )
}
