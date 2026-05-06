import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  editTagChannels,
  getTagModels,
  getAllModels,
  getGroups,
} from '../../api'
import { channelsQueryKeys } from '../../lib'
import type { TagOperationParams } from '../../types'
import { useChannels } from '../channels-provider'

type EditTagDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditTagDialog({ open, onOpenChange }: EditTagDialogProps) {
  const { t } = useTranslation()
  const { currentTag } = useChannels()
  const queryClient = useQueryClient()

  // Form state
  const [newTag, setNewTag] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [customModel, setCustomModel] = useState('')
  const [modelMapping, setModelMapping] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch tag models
  const { data: tagModelsData, isLoading: isLoadingTagModels } = useQuery({
    queryKey: ['tag-models', currentTag],
    queryFn: () => (currentTag ? getTagModels(currentTag) : null),
    enabled: open && !!currentTag,
  })

  // Fetch all available models
  const { data: allModelsData } = useQuery({
    queryKey: ['all-models'],
    queryFn: getAllModels,
    enabled: open,
  })

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
    enabled: open,
  })

  const availableModels =
    allModelsData?.data?.map((m) => m.id).filter(Boolean) || []
  const availableGroups = groupsData?.data || []

  // Initialize form when tag changes
  useEffect(() => {
    if (open && currentTag) {
      setNewTag(currentTag)
      setModelMapping('')
      setSelectedGroups([])
      setCustomModel('')

      // Load tag models
      if (tagModelsData?.data) {
        const models = tagModelsData.data.split(',').filter(Boolean)
        setSelectedModels(models)
      } else {
        setSelectedModels([])
      }
    }
  }, [open, currentTag, tagModelsData])

  const handleAddCustomModel = () => {
    if (!customModel.trim()) return

    const modelsToAdd = customModel
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
      .filter((m) => !selectedModels.includes(m))

    if (modelsToAdd.length > 0) {
      setSelectedModels([...selectedModels, ...modelsToAdd])
      toast.success(
        t('Added {{count}} model(s)', { count: modelsToAdd.length })
      )
      setCustomModel('')
    } else {
      toast.info(t('No new models to add'))
    }
  }

  const handleRemoveModel = (model: string) => {
    setSelectedModels(selectedModels.filter((m) => m !== model))
  }

  const handleToggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    )
  }

  const validateForm = () => {
    // Validate model mapping if provided
    if (modelMapping.trim()) {
      try {
        JSON.parse(modelMapping)
      } catch {
        toast.error(t('Model mapping must be valid JSON'))
        return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (!currentTag) return
    if (!validateForm()) return

    // Check if anything changed
    const hasChanges =
      newTag !== currentTag ||
      modelMapping.trim() ||
      selectedModels.length > 0 ||
      selectedGroups.length > 0

    if (!hasChanges) {
      toast.warning(t('No changes to save'))
      return
    }

    setIsSubmitting(true)
    try {
      const params: Record<string, string | null> = { tag: currentTag }

      if (newTag && newTag !== currentTag) {
        params.new_tag = newTag || null
      }

      if (modelMapping.trim()) {
        params.model_mapping = modelMapping
      }

      if (selectedModels.length > 0) {
        params.models = selectedModels.join(',')
      }

      if (selectedGroups.length > 0) {
        params.groups = selectedGroups.join(',')
      }

      const response = await editTagChannels(
        params as unknown as TagOperationParams
      )

      if (response.success) {
        toast.success(t('Tag updated successfully'))
        queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
        onOpenChange(false)
      } else {
        toast.error(response.message || t('Failed to update tag'))
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to update tag')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  if (!currentTag) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-h-[90vh] max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {t('Edit Tag:')} {currentTag}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Batch edit all channels with this tag. Leave fields empty to keep current values.'
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[60vh] pr-4'>
          <div className='space-y-6'>
            {/* Tag Name */}
            <div className='space-y-2'>
              <Label htmlFor='new-tag'>
                {t('Tag Name')}
                <span className='text-muted-foreground ml-2 text-xs'>
                  {t('(Leave empty to dissolve tag)')}
                </span>
              </Label>
              <Input
                id='new-tag'
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder={t('Enter new tag name or leave empty')}
              />
            </div>

            <Separator />

            {/* Models */}
            <div className='space-y-2'>
              <Label>
                {t('Models')}
                <span className='text-muted-foreground ml-2 text-xs'>
                  {t("(Override all channels' models)")}
                </span>
              </Label>

              {isLoadingTagModels ? (
                <div className='flex items-center gap-2 py-4'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <span className='text-muted-foreground text-sm'>
                    {t('Loading current models...')}
                  </span>
                </div>
              ) : (
                <>
                  <div className='flex min-h-[60px] flex-wrap gap-2 rounded-md border p-3'>
                    {selectedModels.length > 0 ? (
                      selectedModels.map((model) => (
                        <StatusBadge
                          key={model}
                          variant='neutral'
                          className='cursor-pointer transition-opacity hover:opacity-70'
                          copyable={false}
                          onClick={() => handleRemoveModel(model)}
                        >
                          {model} ×
                        </StatusBadge>
                      ))
                    ) : (
                      <span className='text-muted-foreground text-sm'>
                        {t('No models selected')}
                      </span>
                    )}
                  </div>

                  <div className='flex gap-2'>
                    <Select<string>
                      onValueChange={(value) => {
                        if (value === null) return
                        if (!selectedModels.includes(value)) {
                          setSelectedModels([...selectedModels, value])
                        }
                      }}
                    >
                      <SelectTrigger className='flex-1'>
                        <SelectValue
                          placeholder={t('Add from available models...')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className='h-60'>
                          {availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='flex gap-2'>
                    <Input
                      placeholder={t('Custom model (comma-separated)')}
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomModel()
                        }
                      }}
                    />
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={handleAddCustomModel}
                    >
                      {t('Add')}
                    </Button>
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Model Mapping */}
            <div className='space-y-2'>
              <Label htmlFor='model-mapping'>
                {t('Model Mapping (JSON)')}
                <span className='text-muted-foreground ml-2 text-xs'>
                  {t('(Optional: redirect model names)')}
                </span>
              </Label>
              <Textarea
                id='model-mapping'
                value={modelMapping}
                onChange={(e) => setModelMapping(e.target.value)}
                placeholder={'{\n  "gpt-3.5-turbo": "gpt-3.5-turbo-0125"\n}'}
                rows={4}
                className='font-mono text-sm'
              />
              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setModelMapping(
                      JSON.stringify(
                        { 'gpt-3.5-turbo': 'gpt-3.5-turbo-0125' },
                        null,
                        2
                      )
                    )
                  }
                >
                  {t('Example')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setModelMapping(JSON.stringify({}, null, 2))}
                >
                  {t('Clear Mapping')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setModelMapping('')}
                >
                  {t('No Change')}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Groups */}
            <div className='space-y-2'>
              <Label>
                {t('Groups')}
                <span className='text-muted-foreground ml-2 text-xs'>
                  {t("(Override all channels' groups)")}
                </span>
              </Label>
              <div className='flex min-h-[60px] flex-wrap gap-2 rounded-md border p-3'>
                {availableGroups.map((group) => (
                  <GroupBadge
                    key={group}
                    group={group}
                    className={`cursor-pointer rounded-sm transition-opacity hover:opacity-70 ${
                      selectedGroups.includes(group) ? 'bg-muted/70 px-1' : ''
                    }`}
                    onClick={() => handleToggleGroup(group)}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
