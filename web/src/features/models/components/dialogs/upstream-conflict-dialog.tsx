import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { applyUpstreamOverwrite } from '../../api'
import { ERROR_MESSAGES, CONFLICT_FIELD_LABELS } from '../../constants'
import {
  formatConflictValue,
  transformConflictSelectionsToPayload,
  formatSyncResultMessage,
} from '../../lib'
import { useModels } from '../models-provider'

type ConflictData = {
  conflicts: {
    model_name: string
    fields: {
      field: string
      local: unknown
      upstream: unknown
    }[]
  }[]
  locale: string
}

type UpstreamConflictDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: ConflictData | null
}

export function UpstreamConflictDialog({
  open,
  onOpenChange,
  currentRow,
}: UpstreamConflictDialogProps) {
  const { triggerRefresh } = useModels()
  const [selections, setSelections] = useState<Record<string, Set<string>>>({})
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isApplying, setIsApplying] = useState(false)
  const pageSize = 10

  const conflicts = currentRow?.conflicts || []
  const locale = currentRow?.locale || 'zh'

  // Initialize selections
  useEffect(() => {
    if (open && conflicts.length > 0) {
      const init: Record<string, Set<string>> = {}
      conflicts.forEach((item) => {
        init[item.model_name] = new Set()
      })
      setSelections(init)
      setSearchKeyword('')
      setCurrentPage(1)
    }
  }, [open, conflicts])

  // Filter and paginate data
  const filteredConflicts = useMemo(() => {
    const kw = searchKeyword.toLowerCase()
    if (!kw) return conflicts
    return conflicts.filter((item) =>
      item.model_name.toLowerCase().includes(kw)
    )
  }, [conflicts, searchKeyword])

  const totalPages = Math.ceil(filteredConflicts.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pagedConflicts = filteredConflicts.slice(startIndex, endIndex)

  // Get all unique field keys
  const allFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    filteredConflicts.forEach((item) => {
      item.fields.forEach((f) => keys.add(f.field))
    })
    return Array.from(keys)
  }, [filteredConflicts])

  // Toggle individual field
  const toggleField = (modelName: string, field: string, checked: boolean) => {
    setSelections((prev) => {
      const next = { ...prev }
      const set = new Set(next[modelName] || [])
      if (checked) set.add(field)
      else set.delete(field)
      next[modelName] = set
      return next
    })
  }

  // Get header checkbox state for a field
  const getHeaderState = (fieldKey: string) => {
    const presentRows = filteredConflicts.filter((row) =>
      row.fields.some((f) => f.field === fieldKey)
    )
    const selectedCount = presentRows.filter((row) =>
      selections[row.model_name]?.has(fieldKey)
    ).length
    const allCount = presentRows.length

    return {
      checked: allCount > 0 && selectedCount === allCount,
      indeterminate: selectedCount > 0 && selectedCount < allCount,
      hasAny: allCount > 0,
    }
  }

  // Toggle all fields in a column
  const toggleColumn = (fieldKey: string, checked: boolean) => {
    setSelections((prev) => {
      const next = { ...prev }
      filteredConflicts.forEach((row) => {
        if (row.fields.some((f) => f.field === fieldKey)) {
          const set = new Set(next[row.model_name] || [])
          if (checked) set.add(fieldKey)
          else set.delete(fieldKey)
          next[row.model_name] = set
        }
      })
      return next
    })
  }

  const handleApply = async () => {
    const payload = transformConflictSelectionsToPayload(selections)

    if (payload.length === 0) {
      toast.error('Please select at least one field to overwrite')
      return
    }

    setIsApplying(true)
    try {
      const result = await applyUpstreamOverwrite({
        overwrite: payload,
        locale,
      })

      if (result.success) {
        const message = formatSyncResultMessage(result.data || {})
        toast.success(message)
        triggerRefresh()
        onOpenChange(false)
      } else {
        toast.error(result.message || ERROR_MESSAGES.SYNC_FAILED)
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.SYNC_FAILED)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-5xl flex-col'>
        <DialogHeader>
          <DialogTitle>Resolve Conflicts</DialogTitle>
          <DialogDescription>
            Select fields to overwrite with upstream values. Unchecked fields
            will keep local values.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-1 flex-col gap-4 overflow-hidden'>
          {/* Search */}
          <div className='relative'>
            <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <Input
              placeholder='Search models...'
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value)
                setCurrentPage(1)
              }}
              className='pl-9'
            />
          </div>

          {/* Table */}
          {pagedConflicts.length === 0 ? (
            <div className='flex h-32 items-center justify-center'>
              <p className='text-muted-foreground'>
                {searchKeyword ? 'No matching models found' : 'No conflicts'}
              </p>
            </div>
          ) : (
            <div className='flex-1 overflow-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    {allFieldKeys.map((fieldKey) => {
                      const { checked, indeterminate, hasAny } =
                        getHeaderState(fieldKey)
                      if (!hasAny) return null

                      return (
                        <TableHead key={fieldKey}>
                          <div className='flex items-center gap-2'>
                            <Checkbox
                              checked={
                                checked ||
                                (indeterminate ? 'indeterminate' : false)
                              }
                              onCheckedChange={(v) =>
                                toggleColumn(fieldKey, !!v)
                              }
                            />
                            <span>
                              {CONFLICT_FIELD_LABELS[fieldKey] || fieldKey}
                            </span>
                          </div>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedConflicts.map((conflict) => (
                    <TableRow key={conflict.model_name}>
                      <TableCell className='font-medium'>
                        {conflict.model_name}
                      </TableCell>
                      {allFieldKeys.map((fieldKey) => {
                        const field = conflict.fields.find(
                          (f) => f.field === fieldKey
                        )
                        if (!field) {
                          return <TableCell key={fieldKey}>-</TableCell>
                        }

                        const checked =
                          selections[conflict.model_name]?.has(fieldKey) ||
                          false

                        return (
                          <TableCell key={fieldKey}>
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className='flex cursor-pointer items-center gap-2'>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) =>
                                      toggleField(
                                        conflict.model_name,
                                        fieldKey,
                                        !!v
                                      )
                                    }
                                  />
                                  <Badge variant='outline' className='text-xs'>
                                    View Diff
                                  </Badge>
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className='w-[400px]'>
                                <div className='space-y-3'>
                                  <div>
                                    <p className='text-muted-foreground mb-1 text-xs font-medium'>
                                      Local Value
                                    </p>
                                    <pre className='bg-muted rounded p-2 text-xs whitespace-pre-wrap'>
                                      {formatConflictValue(field.local)}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className='text-muted-foreground mb-1 text-xs font-medium'>
                                      Upstream Value
                                    </p>
                                    <pre className='bg-muted rounded p-2 text-xs whitespace-pre-wrap'>
                                      {formatConflictValue(field.upstream)}
                                    </pre>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between'>
              <p className='text-muted-foreground text-sm'>
                Showing {startIndex + 1} to{' '}
                {Math.min(endIndex, filteredConflicts.length)} of{' '}
                {filteredConflicts.length} conflicts
              </p>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isApplying}>
            {isApplying ? 'Applying...' : 'Apply Overwrite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
