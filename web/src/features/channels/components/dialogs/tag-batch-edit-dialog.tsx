import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { MultiSelect } from '@/components/multi-select'
import {
  getTagModels,
  editTagChannels,
  getAllModels,
  getGroups,
} from '../../api'
import { channelsQueryKeys } from '../../lib'
import { useChannels } from '../channels-provider'
import { ModelMappingEditor } from '../model-mapping-editor'

type TagBatchEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TagBatchEditDialog({
  open,
  onOpenChange,
}: TagBatchEditDialogProps) {
  const { currentTag } = useChannels()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form fields
  const [newTag, setNewTag] = useState('')
  const [models, setModels] = useState('')
  const [modelMapping, setModelMapping] = useState('')
  const [groups, setGroups] = useState<string[]>([])

  // Fetch available groups
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  })

  // Transform groups to multi-select options
  const groupOptions = useMemo(() => {
    if (!groupsData?.data) return []
    const allGroups = new Set([...groupsData.data, ...groups])
    return Array.from(allGroups).map((group) => ({
      value: group,
      label: group,
    }))
  }, [groupsData, groups])

  useEffect(() => {
    if (open && currentTag) {
      loadTagData()
    }
  }, [open, currentTag])

  const loadTagData = async () => {
    if (!currentTag) return

    setIsLoading(true)
    try {
      // Fetch current tag models
      const tagModelsResponse = await getTagModels(currentTag)
      if (tagModelsResponse.success && tagModelsResponse.data) {
        setModels(tagModelsResponse.data)
      }

      // Fetch all available models (for future use if needed)
      const allModelsResponse = await getAllModels()
      if (allModelsResponse.success && allModelsResponse.data) {
        // Available models could be used for autocomplete in the future
      }

      // Initialize new tag with current tag name
      setNewTag(currentTag)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load tag data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!currentTag) return

    // Validate model mapping JSON if provided
    if (modelMapping.trim()) {
      try {
        JSON.parse(modelMapping)
      } catch (error) {
        toast.error('Model mapping must be valid JSON')
        return
      }
    }

    setIsSaving(true)
    try {
      const params: any = {
        tag: currentTag,
      }

      if (newTag !== currentTag) {
        params.new_tag = newTag || undefined
      }

      if (models.trim()) {
        params.models = models
      }

      if (modelMapping.trim()) {
        params.model_mapping = modelMapping
      }

      if (groups.length > 0) {
        params.groups = groups.join(',')
      }

      // Check if there are any changes
      if (Object.keys(params).length === 1) {
        toast.warning('No changes made')
        return
      }

      const response = await editTagChannels(params)
      if (response.success) {
        toast.success('Tag updated successfully')
        queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
        handleClose()
      } else {
        toast.error(response.message || 'Failed to update tag')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update tag')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setNewTag('')
    setModels('')
    setModelMapping('')
    setGroups([])
    onOpenChange(false)
  }

  if (!currentTag) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Batch Edit by Tag</DialogTitle>
          <DialogDescription>
            Edit all channels with tag: <strong>{currentTag}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
          </div>
        ) : (
          <>
            <div className='space-y-4 py-4'>
              <Alert>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  All edits are overwrite operations. Leave fields empty to keep
                  current values unchanged.
                </AlertDescription>
              </Alert>

              {/* Tag Name */}
              <div className='space-y-2'>
                <Label htmlFor='new-tag'>Tag Name</Label>
                <Input
                  id='new-tag'
                  placeholder='Enter new tag name (leave empty to disband tag)'
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  disabled={isSaving}
                />
                <p className='text-muted-foreground text-xs'>
                  Leave empty to disband the tag
                </p>
              </div>

              {/* Models */}
              <div className='space-y-2'>
                <Label htmlFor='models'>Models</Label>
                <Textarea
                  id='models'
                  placeholder='Comma-separated model names (leave empty to keep current)'
                  value={models}
                  onChange={(e) => setModels(e.target.value)}
                  disabled={isSaving}
                  rows={3}
                />
                <p className='text-muted-foreground text-xs'>
                  Current models for the longest channel in this tag. May not
                  include all models from all channels.
                </p>
              </div>

              {/* Model Mapping */}
              <div className='space-y-2'>
                <Label htmlFor='model-mapping'>Model Mapping</Label>
                <ModelMappingEditor
                  value={modelMapping}
                  onChange={setModelMapping}
                  disabled={isSaving}
                />
              </div>

              {/* Groups */}
              <div className='space-y-2'>
                <Label htmlFor='groups'>Groups</Label>
                {isLoadingGroups ? (
                  <Skeleton className='h-10 w-full' />
                ) : (
                  <MultiSelect
                    options={groupOptions}
                    selected={groups}
                    onChange={setGroups}
                    placeholder='Select groups (leave empty to keep current)'
                  />
                )}
                <p className='text-muted-foreground text-xs'>
                  User groups that can access channels with this tag
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant='outline'
                onClick={handleClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
