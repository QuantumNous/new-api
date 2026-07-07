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
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  createFeishuGroupPackageMapping,
  deleteFeishuGroupPackageMapping,
  getFeishuGroupPackageMappings,
  getFeishuGroups,
  updateFeishuGroupPackageMapping,
} from '../api'
import { QUERY_KEYS } from '../constants'
import { useGroups } from '../hooks/use-groups'

import type {
  FeishuGroupOption,
  FeishuGroupPackageMapping,
  FeishuGroupPackageMappingPayload,
} from '../types'

type MappingDraft = FeishuGroupPackageMappingPayload

const emptyDraft: MappingDraft = {
  feishu_group_id: '',
  feishu_group_name: '',
  target_group: '',
  enabled: true,
  priority: 0,
  remark: '',
}

function groupOptionValue(group: FeishuGroupOption) {
  return group.id || group.group_id || group.name
}

function groupOptionLabel(group: FeishuGroupOption) {
  return group.name || group.group_id || group.id
}

function buildPayload(
  draft: MappingDraft,
  feishuGroups: FeishuGroupOption[]
): MappingDraft | null {
  const selected = feishuGroups.find(
    (group) => groupOptionValue(group) === draft.feishu_group_id
  )
  if (!selected || !draft.target_group) {
    return null
  }
  return {
    feishu_group_id: selected.group_id || selected.id,
    feishu_group_name: selected.name,
    target_group: draft.target_group,
    enabled: draft.enabled ?? true,
    priority: Number(draft.priority ?? 0),
    remark: draft.remark ?? '',
  }
}

export function FeishuGroupMappings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<MappingDraft>(emptyDraft)

  const groupsQuery = useGroups()
  const tokenGroups = groupsQuery.data?.data ?? []

  const feishuGroupsQuery = useQuery({
    queryKey: QUERY_KEYS.FEISHU_GROUPS,
    queryFn: getFeishuGroups,
    staleTime: 60_000,
  })
  const feishuGroups = useMemo(
    () => feishuGroupsQuery.data?.data?.items ?? [],
    [feishuGroupsQuery.data]
  )

  const mappingsQuery = useQuery({
    queryKey: QUERY_KEYS.FEISHU_GROUP_MAPPINGS,
    queryFn: getFeishuGroupPackageMappings,
  })
  const mappings = mappingsQuery.data?.data?.items ?? []

  const invalidateMappings = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FEISHU_GROUP_MAPPINGS })

  const createMutation = useMutation({
    mutationFn: createFeishuGroupPackageMapping,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Mapping saved successfully'))
        setDraft(emptyDraft)
        void invalidateMappings()
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MappingDraft }) =>
      updateFeishuGroupPackageMapping(id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Mapping updated successfully'))
        void invalidateMappings()
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFeishuGroupPackageMapping,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Mapping deleted successfully'))
        void invalidateMappings()
      }
    },
  })

  const handleCreate = () => {
    const payload = buildPayload(draft, feishuGroups)
    if (!payload) {
      toast.error(t('Please select Feishu group and token group'))
      return
    }
    createMutation.mutate(payload)
  }

  const handleInlineUpdate = (
    mapping: FeishuGroupPackageMapping,
    patch: Partial<MappingDraft>
  ) => {
    updateMutation.mutate({
      id: mapping.id,
      data: {
        feishu_group_id: mapping.feishu_group_id,
        feishu_group_name: mapping.feishu_group_name,
        target_group: mapping.target_group,
        enabled: mapping.enabled,
        priority: mapping.priority,
        remark: mapping.remark,
        ...patch,
      },
    })
  }

  return (
    <div className='flex min-h-0 flex-col gap-4'>
      <Card size='sm'>
        <CardHeader>
          <CardTitle>{t('Feishu Group Package Mapping')}</CardTitle>
          <CardDescription>
            {t('Select Feishu contact groups and map them to token groups.')}
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)_100px_90px_auto]'>
          <Select
            value={draft.feishu_group_id}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, feishu_group_id: value ?? '' }))
            }
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder={t('Select Feishu group')} />
            </SelectTrigger>
            <SelectContent>
              {feishuGroups.map((group) => (
                <SelectItem key={groupOptionValue(group)} value={groupOptionValue(group)}>
                  {groupOptionLabel(group)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={draft.target_group}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, target_group: value ?? '' }))
            }
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder={t('Select token group')} />
            </SelectTrigger>
            <SelectContent>
              {tokenGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type='number'
            value={draft.priority ?? 0}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, priority: Number(event.target.value) }))
            }
            placeholder={t('Priority')}
          />
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={draft.enabled ?? true}
              onCheckedChange={(value) =>
                setDraft((prev) => ({ ...prev, enabled: !!value }))
              }
            />
            {t('Enabled')}
          </label>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            <Plus className='size-4' />
            {t('Add mapping')}
          </Button>
        </CardContent>
      </Card>

      <Card size='sm' className='min-h-0 flex-1 overflow-hidden'>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Feishu contact group')}</TableHead>
                <TableHead>{t('Token group')}</TableHead>
                <TableHead>{t('Priority')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground h-24 text-center'>
                    {t('No mappings configured')}
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div className='font-medium'>{mapping.feishu_group_name}</div>
                      <div className='text-muted-foreground text-xs'>
                        {mapping.feishu_group_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping.target_group}
                        onValueChange={(value) =>
                          handleInlineUpdate(mapping, { target_group: value ?? '' })
                        }
                      >
                        <SelectTrigger className='w-48'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tokenGroups.map((group) => (
                            <SelectItem key={group} value={group}>
                              {group}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{mapping.priority}</TableCell>
                    <TableCell>
                      <label className='flex items-center gap-2 text-sm'>
                        <Checkbox
                          checked={mapping.enabled}
                          onCheckedChange={(value) =>
                            handleInlineUpdate(mapping, { enabled: !!value })
                          }
                        />
                        {mapping.enabled ? t('Enabled') : t('Disabled')}
                      </label>
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='icon'
                        variant='ghost'
                        onClick={() => deleteMutation.mutate(mapping.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
