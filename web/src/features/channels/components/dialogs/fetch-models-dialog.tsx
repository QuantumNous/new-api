import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchUpstreamModels, updateChannel } from '../../api'
import { channelsQueryKeys } from '../../lib'
import { useChannels } from '../channels-provider'

type FetchModelsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FetchModelsDialog({
  open,
  onOpenChange,
}: FetchModelsDialogProps) {
  const { currentRow } = useChannels()
  const queryClient = useQueryClient()
  const [isFetching, setIsFetching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')

  // Parse existing models
  const existingModels = currentRow?.models
    ? currentRow.models.split(',').map((m) => m.trim())
    : []

  useEffect(() => {
    if (open && currentRow) {
      handleFetchModels()
    }
  }, [open, currentRow?.id])

  const handleFetchModels = async () => {
    if (!currentRow) return

    setIsFetching(true)
    try {
      const response = await fetchUpstreamModels(currentRow.id)
      if (response.success && response.data) {
        setFetchedModels(response.data)
        // Pre-select existing models
        setSelectedModels(existingModels)
        toast.success(`Fetched ${response.data.length} models`)
      } else {
        toast.error(response.message || 'Failed to fetch models')
        setFetchedModels([])
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fetch models')
      setFetchedModels([])
    } finally {
      setIsFetching(false)
    }
  }

  const handleSave = async () => {
    if (!currentRow) return

    setIsSaving(true)
    try {
      const modelsString = selectedModels.join(',')
      const response = await updateChannel(currentRow.id, {
        models: modelsString,
      })
      if (response.success) {
        toast.success('Models updated successfully')
        queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
        onOpenChange(false)
      } else {
        toast.error(response.message || 'Failed to update models')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update models')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setFetchedModels([])
    setSelectedModels([])
    setSearchKeyword('')
    onOpenChange(false)
  }

  // Categorize models by common prefixes
  const categorizeModels = (models: string[]) => {
    const categories: Record<string, string[]> = {}

    models.forEach((model) => {
      let category = 'Other'

      // Determine category based on model name
      if (
        model.toLowerCase().includes('gpt') ||
        model.toLowerCase().includes('o1') ||
        model.toLowerCase().includes('o3')
      ) {
        category = 'OpenAI'
      } else if (model.toLowerCase().includes('claude')) {
        category = 'Anthropic'
      } else if (model.toLowerCase().includes('gemini')) {
        category = 'Gemini'
      } else if (model.toLowerCase().includes('qwen')) {
        category = 'Qwen'
      } else if (model.toLowerCase().includes('deepseek')) {
        category = 'DeepSeek'
      } else if (model.toLowerCase().includes('glm')) {
        category = 'Zhipu'
      } else if (model.toLowerCase().includes('llama')) {
        category = 'Meta'
      } else if (model.toLowerCase().includes('mistral')) {
        category = 'Mistral'
      }

      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(model)
    })

    return categories
  }

  // Filter models by search
  const filteredModels = useMemo(() => {
    if (!searchKeyword) return fetchedModels
    return fetchedModels.filter((model) =>
      model.toLowerCase().includes(searchKeyword.toLowerCase())
    )
  }, [fetchedModels, searchKeyword])

  // Separate new and existing models
  const newModels = filteredModels.filter((m) => !existingModels.includes(m))
  const existingFilteredModels = filteredModels.filter((m) =>
    existingModels.includes(m)
  )

  const newModelsByCategory = categorizeModels(newModels)
  const existingModelsByCategory = categorizeModels(existingFilteredModels)

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    )
  }

  const toggleCategory = (categoryModels: string[], isChecked: boolean) => {
    setSelectedModels((prev) => {
      if (isChecked) {
        const newSelected = [...prev]
        categoryModels.forEach((model) => {
          if (!newSelected.includes(model)) {
            newSelected.push(model)
          }
        })
        return newSelected
      } else {
        return prev.filter((m) => !categoryModels.includes(m))
      }
    })
  }

  const isCategorySelected = (categoryModels: string[]) => {
    return categoryModels.every((m) => selectedModels.includes(m))
  }

  const renderModelCategory = (
    categoryName: string,
    categoryModels: string[]
  ) => {
    const allSelected = isCategorySelected(categoryModels)

    return (
      <Collapsible key={categoryName} defaultOpen>
        <CollapsibleTrigger className='hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border p-3'>
          <div className='flex items-center gap-2'>
            <ChevronDown className='h-4 w-4' />
            <span className='font-medium'>
              {categoryName} ({categoryModels.length})
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground text-sm'>
              {categoryModels.filter((m) => selectedModels.includes(m)).length}{' '}
              / {categoryModels.length} selected
            </span>
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) =>
                toggleCategory(categoryModels, !!checked)
              }
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className='px-4 py-2'>
          <div className='grid grid-cols-2 gap-2'>
            {categoryModels.map((model) => (
              <div key={model} className='flex items-center space-x-2'>
                <Checkbox
                  id={model}
                  checked={selectedModels.includes(model)}
                  onCheckedChange={() => toggleModel(model)}
                />
                <Label
                  htmlFor={model}
                  className='cursor-pointer text-sm font-normal'
                >
                  {model}
                </Label>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Fetch Models</DialogTitle>
          <DialogDescription>
            Fetch available models for: <strong>{currentRow?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {!currentRow ? (
          <div className='text-muted-foreground py-8 text-center'>
            No channel selected
          </div>
        ) : isFetching ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
          </div>
        ) : fetchedModels.length === 0 ? (
          <div className='text-muted-foreground py-8 text-center'>
            <p>No models fetched yet.</p>
            <Button
              className='mt-4'
              onClick={handleFetchModels}
              disabled={isFetching}
            >
              Fetch Models
            </Button>
          </div>
        ) : (
          <>
            <div className='space-y-4'>
              {/* Search Bar */}
              <div className='relative'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  placeholder='Search models...'
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className='pl-9'
                />
              </div>

              {/* Tabs for New vs Existing */}
              <Tabs defaultValue={newModels.length > 0 ? 'new' : 'existing'}>
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='new' disabled={newModels.length === 0}>
                    New Models ({newModels.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value='existing'
                    disabled={existingFilteredModels.length === 0}
                  >
                    Existing Models ({existingFilteredModels.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value='new'
                  className='max-h-96 space-y-2 overflow-y-auto'
                >
                  {Object.entries(newModelsByCategory).map(
                    ([category, models]) =>
                      renderModelCategory(category, models)
                  )}
                </TabsContent>

                <TabsContent
                  value='existing'
                  className='max-h-96 space-y-2 overflow-y-auto'
                >
                  {Object.entries(existingModelsByCategory).map(
                    ([category, models]) =>
                      renderModelCategory(category, models)
                  )}
                </TabsContent>
              </Tabs>

              {/* Selection Summary */}
              <div className='bg-muted/50 rounded-lg border p-3 text-sm'>
                <strong>{selectedModels.length}</strong> model(s) selected out
                of <strong>{filteredModels.length}</strong>
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
                {isSaving ? 'Saving...' : 'Save Models'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
