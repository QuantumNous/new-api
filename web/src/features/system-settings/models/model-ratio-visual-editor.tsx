import { useState, useMemo, useEffect, memo, useCallback } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { safeJsonParse } from '../utils/json-parser'
import { ModelRatioDialog, type ModelRatioData } from './model-ratio-dialog'

type ModelRatioVisualEditorProps = {
  modelPrice: string
  modelRatio: string
  cacheRatio: string
  completionRatio: string
  imageRatio: string
  audioRatio: string
  audioCompletionRatio: string
  onChange: (field: string, value: string) => void
}

type ModelRow = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  hasConflict: boolean
}

const STORAGE_KEY = 'model-ratio-show-advanced-columns'

// Simple debounce for localStorage writes
function debounce(
  fn: (value: boolean) => void,
  delay: number
): ((value: boolean) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = ((value: boolean) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(value), delay)
  }) as ((value: boolean) => void) & { cancel: () => void }

  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
  }

  return debounced
}

export const ModelRatioVisualEditor = memo(
  function ModelRatioVisualEditor({
    modelPrice,
    modelRatio,
    cacheRatio,
    completionRatio,
    imageRatio,
    audioRatio,
    audioCompletionRatio,
    onChange,
  }: ModelRatioVisualEditorProps) {
    const [searchText, setSearchText] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editData, setEditData] = useState<ModelRatioData | null>(null)
    const [showAdvancedColumns, setShowAdvancedColumns] = useState(() => {
      const saved = localStorage.getItem(STORAGE_KEY)
      return safeJsonParse<boolean>(saved, { fallback: false, silent: true })
    })

    // Debounced localStorage save
    const debouncedSaveColumns = useMemo(
      () =>
        debounce((value: boolean) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
        }, 500),
      []
    )

    useEffect(() => {
      debouncedSaveColumns(showAdvancedColumns)
      return () => debouncedSaveColumns.cancel()
    }, [showAdvancedColumns, debouncedSaveColumns])

    const models = useMemo(() => {
      const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
        fallback: {},
        context: 'model prices',
      })
      const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
        fallback: {},
        context: 'model ratios',
      })
      const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
        fallback: {},
        context: 'cache ratios',
      })
      const completionMap = safeJsonParse<Record<string, number>>(
        completionRatio,
        { fallback: {}, context: 'completion ratios' }
      )
      const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
        fallback: {},
        context: 'image ratios',
      })
      const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
        fallback: {},
        context: 'audio ratios',
      })
      const audioCompletionMap = safeJsonParse<Record<string, number>>(
        audioCompletionRatio,
        { fallback: {}, context: 'audio completion ratios' }
      )

      const modelNames = new Set([
        ...Object.keys(priceMap),
        ...Object.keys(ratioMap),
        ...Object.keys(cacheMap),
        ...Object.keys(completionMap),
        ...Object.keys(imageMap),
        ...Object.keys(audioMap),
        ...Object.keys(audioCompletionMap),
      ])

      const modelData: ModelRow[] = Array.from(modelNames).map((name) => {
        const price = priceMap[name]?.toString() || ''
        const ratio = ratioMap[name]?.toString() || ''
        const cache = cacheMap[name]?.toString() || ''
        const completion = completionMap[name]?.toString() || ''
        const image = imageMap[name]?.toString() || ''
        const audio = audioMap[name]?.toString() || ''
        const audioCompletion = audioCompletionMap[name]?.toString() || ''

        return {
          name,
          price,
          ratio,
          cacheRatio: cache,
          completionRatio: completion,
          imageRatio: image,
          audioRatio: audio,
          audioCompletionRatio: audioCompletion,
          hasConflict:
            price !== '' &&
            (ratio !== '' ||
              completion !== '' ||
              cache !== '' ||
              image !== '' ||
              audio !== '' ||
              audioCompletion !== ''),
        }
      })

      return modelData.sort((a, b) => a.name.localeCompare(b.name))
    }, [
      modelPrice,
      modelRatio,
      cacheRatio,
      completionRatio,
      imageRatio,
      audioRatio,
      audioCompletionRatio,
    ])

    const filteredModels = useMemo(() => {
      if (!searchText) return models
      return models.filter((model) =>
        model.name.toLowerCase().includes(searchText.toLowerCase())
      )
    }, [models, searchText])

    const handleSave = useCallback(
      (data: ModelRatioData) => {
        const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
          fallback: {},
          silent: true,
        })
        const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
          fallback: {},
          silent: true,
        })
        const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
          fallback: {},
          silent: true,
        })
        const completionMap = safeJsonParse<Record<string, number>>(
          completionRatio,
          { fallback: {}, silent: true }
        )
        const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
          fallback: {},
          silent: true,
        })
        const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
          fallback: {},
          silent: true,
        })
        const audioCompletionMap = safeJsonParse<Record<string, number>>(
          audioCompletionRatio,
          { fallback: {}, silent: true }
        )

        // Remove from all maps first (in case of edit or mode switch)
        delete priceMap[data.name]
        delete ratioMap[data.name]
        delete cacheMap[data.name]
        delete completionMap[data.name]
        delete imageMap[data.name]
        delete audioMap[data.name]
        delete audioCompletionMap[data.name]

        // Add to appropriate maps based on data
        if (data.price && data.price !== '') {
          priceMap[data.name] = parseFloat(data.price)
        } else {
          if (data.ratio && data.ratio !== '')
            ratioMap[data.name] = parseFloat(data.ratio)
          if (data.cacheRatio && data.cacheRatio !== '')
            cacheMap[data.name] = parseFloat(data.cacheRatio)
          if (data.completionRatio && data.completionRatio !== '')
            completionMap[data.name] = parseFloat(data.completionRatio)
          if (data.imageRatio && data.imageRatio !== '')
            imageMap[data.name] = parseFloat(data.imageRatio)
          if (data.audioRatio && data.audioRatio !== '')
            audioMap[data.name] = parseFloat(data.audioRatio)
          if (data.audioCompletionRatio && data.audioCompletionRatio !== '')
            audioCompletionMap[data.name] = parseFloat(
              data.audioCompletionRatio
            )
        }

        onChange('ModelPrice', JSON.stringify(priceMap, null, 2))
        onChange('ModelRatio', JSON.stringify(ratioMap, null, 2))
        onChange('CacheRatio', JSON.stringify(cacheMap, null, 2))
        onChange('CompletionRatio', JSON.stringify(completionMap, null, 2))
        onChange('ImageRatio', JSON.stringify(imageMap, null, 2))
        onChange('AudioRatio', JSON.stringify(audioMap, null, 2))
        onChange(
          'AudioCompletionRatio',
          JSON.stringify(audioCompletionMap, null, 2)
        )
      },
      [
        modelPrice,
        modelRatio,
        cacheRatio,
        completionRatio,
        imageRatio,
        audioRatio,
        audioCompletionRatio,
        onChange,
      ]
    )

    const handleDelete = useCallback(
      (name: string) => {
        const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
          fallback: {},
          silent: true,
        })
        const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
          fallback: {},
          silent: true,
        })
        const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
          fallback: {},
          silent: true,
        })
        const completionMap = safeJsonParse<Record<string, number>>(
          completionRatio,
          { fallback: {}, silent: true }
        )
        const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
          fallback: {},
          silent: true,
        })
        const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
          fallback: {},
          silent: true,
        })
        const audioCompletionMap = safeJsonParse<Record<string, number>>(
          audioCompletionRatio,
          { fallback: {}, silent: true }
        )

        delete priceMap[name]
        delete ratioMap[name]
        delete cacheMap[name]
        delete completionMap[name]
        delete imageMap[name]
        delete audioMap[name]
        delete audioCompletionMap[name]

        onChange('ModelPrice', JSON.stringify(priceMap, null, 2))
        onChange('ModelRatio', JSON.stringify(ratioMap, null, 2))
        onChange('CacheRatio', JSON.stringify(cacheMap, null, 2))
        onChange('CompletionRatio', JSON.stringify(completionMap, null, 2))
        onChange('ImageRatio', JSON.stringify(imageMap, null, 2))
        onChange('AudioRatio', JSON.stringify(audioMap, null, 2))
        onChange(
          'AudioCompletionRatio',
          JSON.stringify(audioCompletionMap, null, 2)
        )
      },
      [
        modelPrice,
        modelRatio,
        cacheRatio,
        completionRatio,
        imageRatio,
        audioRatio,
        audioCompletionRatio,
        onChange,
      ]
    )

    const handleEdit = (model: ModelRow) => {
      setEditData(model)
      setDialogOpen(true)
    }

    const handleAdd = () => {
      setEditData(null)
      setDialogOpen(true)
    }

    const formatValue = (value?: string) => {
      if (!value || value === '') return '—'
      return value
    }

    return (
      <div className='space-y-4'>
        <div className='flex items-center gap-4'>
          <div className='relative flex-1'>
            <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
            <Input
              placeholder='Search models...'
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className='pl-9'
            />
          </div>
          <div className='flex items-center gap-2'>
            <Checkbox
              id='show-advanced'
              checked={showAdvancedColumns}
              onCheckedChange={(checked) =>
                setShowAdvancedColumns(checked as boolean)
              }
            />
            <Label
              htmlFor='show-advanced'
              className='cursor-pointer text-sm font-normal'
            >
              Show advanced columns
            </Label>
          </div>
          <Button onClick={handleAdd}>
            <Plus className='mr-2 h-4 w-4' />
            Add model
          </Button>
        </div>

        {filteredModels.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center'>
            {searchText
              ? 'No models match your search'
              : 'No models configured. Click "Add model" to get started.'}
          </div>
        ) : (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model name</TableHead>
                  <TableHead>Fixed price</TableHead>
                  <TableHead>Ratio</TableHead>
                  <TableHead>Completion</TableHead>
                  {showAdvancedColumns && (
                    <>
                      <TableHead>Cache</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Audio</TableHead>
                      <TableHead>Audio comp.</TableHead>
                    </>
                  )}
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model) => (
                  <TableRow key={model.name}>
                    <TableCell className='font-medium'>
                      <div className='flex items-center gap-2'>
                        {model.name}
                        {model.hasConflict && (
                          <Badge variant='destructive' className='text-xs'>
                            Conflict
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatValue(model.price)}</TableCell>
                    <TableCell
                      className={model.price ? 'text-muted-foreground' : ''}
                    >
                      {formatValue(model.ratio)}
                    </TableCell>
                    <TableCell
                      className={model.price ? 'text-muted-foreground' : ''}
                    >
                      {formatValue(model.completionRatio)}
                    </TableCell>
                    {showAdvancedColumns && (
                      <>
                        <TableCell
                          className={model.price ? 'text-muted-foreground' : ''}
                        >
                          {formatValue(model.cacheRatio)}
                        </TableCell>
                        <TableCell
                          className={model.price ? 'text-muted-foreground' : ''}
                        >
                          {formatValue(model.imageRatio)}
                        </TableCell>
                        <TableCell
                          className={model.price ? 'text-muted-foreground' : ''}
                        >
                          {formatValue(model.audioRatio)}
                        </TableCell>
                        <TableCell
                          className={model.price ? 'text-muted-foreground' : ''}
                        >
                          {formatValue(model.audioCompletionRatio)}
                        </TableCell>
                      </>
                    )}
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleEdit(model)}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleDelete(model.name)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <ModelRatioDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSave}
          editData={editData}
        />
      </div>
    )
  },
  // Custom equality check - only re-render if JSON props actually changed
  (prevProps, nextProps) => {
    return (
      prevProps.modelPrice === nextProps.modelPrice &&
      prevProps.modelRatio === nextProps.modelRatio &&
      prevProps.cacheRatio === nextProps.cacheRatio &&
      prevProps.completionRatio === nextProps.completionRatio &&
      prevProps.imageRatio === nextProps.imageRatio &&
      prevProps.audioRatio === nextProps.audioRatio &&
      prevProps.audioCompletionRatio === nextProps.audioCompletionRatio &&
      prevProps.onChange === nextProps.onChange
    )
  }
)
