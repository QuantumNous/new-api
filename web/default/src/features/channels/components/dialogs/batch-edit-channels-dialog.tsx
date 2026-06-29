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
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/dialog'
import { MultiSelect } from '@/components/multi-select'
import { getGroups } from '../../api'
import { handleBatchEdit } from '../../lib'
import { ModelMappingEditor } from '../model-mapping-editor'

interface BatchEditChannelsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ids: number[]
}

export function BatchEditChannelsDialog({
  open,
  onOpenChange,
  ids,
}: BatchEditChannelsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)

  const [models, setModels] = useState('')
  const [modelMapping, setModelMapping] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [priority, setPriority] = useState('')
  const [weight, setWeight] = useState('')

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  })

  const groupOptions = useMemo(() => {
    if (!groupsData?.data) return []
    const allGroups = new Set([...groupsData.data, ...groups])
    return Array.from(allGroups).map((group) => ({ value: group, label: group }))
  }, [groupsData, groups])

  const handleSave = async () => {
    if (modelMapping.trim()) {
      try {
        JSON.parse(modelMapping)
      } catch {
        toast.error(t('Model mapping must be valid JSON'))
        return
      }
    }

    const payload: {
      models?: string
      model_mapping?: string
      groups?: string
      priority?: number
      weight?: number
    } = {}

    if (models.trim()) payload.models = models.trim()
    if (modelMapping.trim()) payload.model_mapping = modelMapping.trim()
    if (groups.length > 0) payload.groups = groups.join(',')
    if (priority.trim() !== '') {
      const n = Number(priority)
      if (Number.isNaN(n) || !Number.isInteger(n)) {
        toast.error(t('Priority must be an integer'))
        return
      }
      payload.priority = n
    }
    if (weight.trim() !== '') {
      const n = Number(weight)
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
        toast.error(t('Weight must be a non-negative integer'))
        return
      }
      payload.weight = n
    }

    setIsSaving(true)
    try {
      await handleBatchEdit(ids, payload, queryClient, () => {
        handleClose()
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setModels('')
    setModelMapping('')
    setGroups([])
    setPriority('')
    setWeight('')
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={t('Batch Edit')}
      description={t('Batch edit {{count}} selected channel(s)', {
        count: ids.length,
      })}
      contentClassName='max-w-2xl'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={handleClose} disabled={isSaving}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
            {isSaving ? t('Saving...') : t('Save Changes')}
          </Button>
        </>
      }
    >
      <div className='space-y-4 py-4'>
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            {t(
              'All edits are overwrite operations. Leave fields empty to keep current values unchanged.'
            )}
          </AlertDescription>
        </Alert>

        {/* Models */}
        <div className='space-y-2'>
          <Label htmlFor='batch-edit-models'>{t('Models')}</Label>
          <Textarea
            id='batch-edit-models'
            placeholder={t(
              'Comma-separated model names (leave empty to keep current)'
            )}
            value={models}
            onChange={(e) => setModels(e.target.value)}
            disabled={isSaving}
            rows={3}
          />
        </div>

        {/* Model Mapping */}
        <div className='space-y-2'>
          <Label htmlFor='batch-edit-model-mapping'>{t('Model Mapping')}</Label>
          <ModelMappingEditor
            value={modelMapping}
            onChange={setModelMapping}
            disabled={isSaving}
          />
        </div>

        {/* Groups */}
        <div className='space-y-2'>
          <Label htmlFor='batch-edit-groups'>{t('Groups')}</Label>
          {isLoadingGroups ? (
            <Skeleton className='h-10 w-full' />
          ) : (
            <MultiSelect
              options={groupOptions}
              selected={groups}
              onChange={setGroups}
              placeholder={t('Select groups (leave empty to keep current)')}
            />
          )}
        </div>

        {/* Priority & Weight */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='batch-edit-priority'>{t('Priority')}</Label>
            <Input
              id='batch-edit-priority'
              type='number'
              placeholder={t('Leave empty to keep current')}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='batch-edit-weight'>{t('Weight')}</Label>
            <Input
              id='batch-edit-weight'
              type='number'
              placeholder={t('Leave empty to keep current')}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>
      </div>
    </Dialog>
  )
}
