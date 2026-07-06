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
import { Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'

import { getAutoGroupConfig, updateAutoGroupConfig } from '../api'
import { QUERY_KEYS, SUCCESS_MESSAGES } from '../constants'
import { useGroups } from '../hooks/use-groups'

export function ProtectedGroupsConfig() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: groupsData } = useGroups()
  const groups = groupsData?.data ?? []

  const configQuery = useQuery({
    queryKey: QUERY_KEYS.CONFIG,
    queryFn: getAutoGroupConfig,
  })

  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (configQuery.data?.data) {
      setSelected(configQuery.data.data.protected_groups ?? [])
    }
  }, [configQuery.data])

  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify(
      [...(configQuery.data?.data?.protected_groups ?? [])].sort()
    )

  const updateMutation = useMutation({
    mutationFn: updateAutoGroupConfig,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.CONFIG_UPDATED))
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CONFIG })
      }
    },
  })

  const toggleGroup = (group: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, group] : prev.filter((g) => g !== group)
    )
  }

  const handleSave = () => {
    updateMutation.mutate({ protected_groups: selected })
  }

  return (
    <Card size='sm' className='shrink-0 border-dashed bg-muted/20'>
      <CardHeader className='flex flex-row items-start justify-between gap-4 pb-3'>
        <div className='space-y-1'>
          <CardTitle className='flex items-center gap-1.5 text-sm'>
            <Shield className='size-4 text-muted-foreground' />
            {t('Protected Groups')}
          </CardTitle>
          <CardDescription>
            {t('Auto rules skip users already in these groups.')}
          </CardDescription>
        </div>
        <Button
          size='sm'
          variant='outline'
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? t('Saving...') : t('Save')}
        </Button>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No groups available')}
          </p>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {groups.map((group) => {
              const checked = selected.includes(group)
              return (
                <Label
                  key={group}
                  className='hover:bg-muted flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors'
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleGroup(group, !!value)}
                  />
                  {group}
                </Label>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
