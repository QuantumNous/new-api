import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import {
  confirmAutoGroupSuggestion,
  getAutoGroupSuggestions,
  skipAutoGroupSuggestion,
} from '../api'
import { QUERY_KEYS } from '../constants'
import { useGroups } from '../hooks/use-groups'
import type { AutoGroupSuggestion } from '../types'

export function SuggestionsTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedGroups, setSelectedGroups] = useState<Record<number, string>>({})
  const { data: groupsData } = useGroups()
  const groups = groupsData?.data ?? []
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.SUGGESTIONS,
    queryFn: () => getAutoGroupSuggestions('pending'),
  })
  const suggestions = data?.data?.items ?? []

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUGGESTIONS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD }),
    ])
  }

  const confirmMutation = useMutation({
    mutationFn: ({ id, group }: { id: number; group: string }) =>
      confirmAutoGroupSuggestion(id, group),
    onSuccess: async (result) => {
      if (result.success) {
        toast.success(t('Suggestion confirmed'))
        await invalidate()
      }
    },
  })

  const skipMutation = useMutation({
    mutationFn: skipAutoGroupSuggestion,
    onSuccess: async (result) => {
      if (result.success) {
        toast.success(t('Suggestion skipped'))
        await invalidate()
      }
    },
  })

  const pendingSuggestions = suggestions.filter((item) => item.action !== 'skip')

  return (
    <Card size='sm' className='min-h-0'>
      <CardHeader>
        <CardTitle>{t('Pending users')}</CardTitle>
      </CardHeader>
      <CardContent className='overflow-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('User')}</TableHead>
              <TableHead>{t('Job title')}</TableHead>
              <TableHead>{t('Current group')}</TableHead>
              <TableHead>{t('Suggested group')}</TableHead>
              <TableHead>{t('Confidence')}</TableHead>
              <TableHead>{t('Organization')}</TableHead>
              <TableHead>{t('Reason')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8}>{t('Loading...')}</TableCell></TableRow>
            ) : pendingSuggestions.length === 0 ? (
              <TableRow><TableCell colSpan={8}>{t('No pending suggestions. Replay current users to generate suggestions.')}</TableCell></TableRow>
            ) : (
              pendingSuggestions.map((item) => (
                <SuggestionRow
                  key={item.id}
                  item={item}
                  groups={groups}
                  selectedGroup={selectedGroups[item.id] ?? item.suggested_group}
                  onGroupChange={(group) => setSelectedGroups((prev) => ({ ...prev, [item.id]: group }))}
                  onConfirm={() => confirmMutation.mutate({ id: item.id, group: selectedGroups[item.id] ?? item.suggested_group })}
                  onSkip={() => skipMutation.mutate(item.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function SuggestionRow({
  item,
  groups,
  selectedGroup,
  onGroupChange,
  onConfirm,
  onSkip,
}: {
  item: AutoGroupSuggestion
  groups: string[]
  selectedGroup: string
  onGroupChange: (group: string) => void
  onConfirm: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation()
  return (
    <TableRow>
      <TableCell>
        <div className='font-medium'>{item.display_name || item.username}</div>
        <div className='text-xs text-muted-foreground'>{item.email}</div>
      </TableCell>
      <TableCell>{item.job_title || '-'}</TableCell>
      <TableCell>{item.current_group}</TableCell>
      <TableCell>
        <Select value={selectedGroup || undefined} onValueChange={(value) => value && onGroupChange(value)}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder={t('Select group')} />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell><Badge variant={item.confidence === 'high' ? 'default' : 'secondary'}>{item.confidence}</Badge></TableCell>
      <TableCell>
        <div className='max-w-56 text-xs'>
          <div>{item.org_level1_name || '-'}</div>
          <div className='text-muted-foreground'>{item.department_name || item.parent_department_name || '-'}</div>
        </div>
      </TableCell>
      <TableCell className='max-w-72 text-xs text-muted-foreground'>{item.reason}</TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-2'>
          <Button size='sm' onClick={onConfirm} disabled={!selectedGroup}>{t('Confirm')}</Button>
          <Button size='sm' variant='outline' onClick={onSkip}>{t('Skip')}</Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
