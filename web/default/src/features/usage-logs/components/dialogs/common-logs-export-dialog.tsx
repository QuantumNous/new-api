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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { exportCommonLogsXlsx, getCommonLogExportFields } from '../../api'
import type { GetLogsParams, LogExportFieldGroup } from '../../types'

interface CommonLogsExportDialogProps {
  params: GetLogsParams
  isAdmin: boolean
  disabled?: boolean
}

export function CommonLogsExportDialog(props: CommonLogsExportDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const initializedOpenRef = useRef(false)

  const fieldsQuery = useQuery({
    queryKey: ['usage-log-export-fields', props.isAdmin],
    queryFn: async () => {
      const res = await getCommonLogExportFields(props.isAdmin)
      if (!res.success)
        throw new Error(res.message || t('Failed to load export fields'))
      return res.data || []
    },
    enabled: open,
  })

  const groups = fieldsQuery.data || []
  const allFields = useMemo(
    () => groups.flatMap((group) => group.fields),
    [groups]
  )

  useEffect(() => {
    if (!open) {
      initializedOpenRef.current = false
      return
    }
    if (initializedOpenRef.current || allFields.length === 0) return
    setSelectedFields(
      new Set(
        allFields.filter((field) => field.default).map((field) => field.key)
      )
    )
    initializedOpenRef.current = true
  }, [open, allFields])

  const selectedFieldKeys = useMemo(
    () =>
      allFields
        .map((field) => field.key)
        .filter((key) => selectedFields.has(key)),
    [allFields, selectedFields]
  )

  const exportMutation = useMutation({
    mutationFn: async () =>
      exportCommonLogsXlsx(props.params, selectedFieldKeys, props.isAdmin),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t('Export started'))
      setOpen(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Export failed'))
    },
  })

  const toggleField = (key: string, checked: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleGroup = (group: LogExportFieldGroup, checked: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      for (const field of group.fields) {
        if (checked) next.add(field.key)
        else next.delete(field.key)
      }
      return next
    })
  }

  const selectAll = () =>
    setSelectedFields(new Set(allFields.map((field) => field.key)))
  const clearAll = () => setSelectedFields(new Set())

  const isExporting = exportMutation.isPending
  const isLoadingFields = fieldsQuery.isLoading || fieldsQuery.isFetching
  const canExport =
    selectedFieldKeys.length > 0 && !isExporting && !isLoadingFields

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type='button' variant='outline' disabled={props.disabled} />
        }
      >
        <Download className='size-4' />
        {t('Export')}
      </DialogTrigger>
      <DialogContent className='flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Export Usage Logs')}</DialogTitle>
          <DialogDescription>
            {t('Select the fields to include in the Excel export.')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex items-center justify-between gap-2 text-sm'>
          <span className='text-muted-foreground'>
            {t('{{count}} fields selected', {
              count: selectedFieldKeys.length,
            })}
          </span>
          <div className='flex items-center gap-1.5'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={selectAll}
              disabled={allFields.length === 0}
            >
              {t('Select All')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={clearAll}
              disabled={selectedFieldKeys.length === 0}
            >
              {t('Clear')}
            </Button>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
          {isLoadingFields ? (
            <div className='text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm'>
              <Loader2 className='size-4 animate-spin' />
              {t('Loading...')}
            </div>
          ) : fieldsQuery.isError ? (
            <div className='text-destructive py-8 text-center text-sm'>
              {fieldsQuery.error instanceof Error
                ? fieldsQuery.error.message
                : t('Failed to load export fields')}
            </div>
          ) : (
            <div className='space-y-4'>
              {groups.map((group) => {
                const groupSelectedCount = group.fields.filter((field) =>
                  selectedFields.has(field.key)
                ).length
                const groupChecked =
                  groupSelectedCount === group.fields.length &&
                  group.fields.length > 0
                return (
                  <section key={group.key} className='rounded-lg border p-3'>
                    <div className='mb-3 flex items-center justify-between gap-2'>
                      <div>
                        <h3 className='text-sm font-medium'>
                          {t(group.label)}
                        </h3>
                        <p className='text-muted-foreground text-xs'>
                          {t('{{selected}}/{{total}} selected', {
                            selected: groupSelectedCount,
                            total: group.fields.length,
                          })}
                        </p>
                      </div>
                      <label className='flex cursor-pointer items-center gap-2 text-xs'>
                        <Checkbox
                          checked={groupChecked}
                          onCheckedChange={(value) =>
                            toggleGroup(group, value === true)
                          }
                        />
                        {t('Select section')}
                      </label>
                    </div>
                    <div className='grid gap-2 sm:grid-cols-2'>
                      {group.fields.map((field) => (
                        <label
                          key={field.key}
                          className='hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm'
                        >
                          <Checkbox
                            checked={selectedFields.has(field.key)}
                            onCheckedChange={(value) =>
                              toggleField(field.key, value === true)
                            }
                          />
                          <span>{t(field.label)}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type='button' variant='outline' />}>
            {t('Cancel')}
          </DialogClose>
          <Button
            type='button'
            onClick={() => exportMutation.mutate()}
            disabled={!canExport}
          >
            {isExporting && <Loader2 className='size-4 animate-spin' />}
            {t('Export Excel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
