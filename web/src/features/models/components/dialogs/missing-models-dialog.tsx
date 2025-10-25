import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { getMissingModels } from '../../api'
import { DEFAULT_PAGE_SIZE } from '../../constants'
import { modelsQueryKeys } from '../../lib'
import { useModels } from '../models-provider'

type MissingModelsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MissingModelsDialog({
  open,
  onOpenChange,
}: MissingModelsDialogProps) {
  const { setOpen, setCurrentRow } = useModels()
  const isMobile = useIsMobile()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: modelsQueryKeys.missing(),
    queryFn: getMissingModels,
    enabled: open,
  })

  const missingModels = data?.data || []
  const pageSize = DEFAULT_PAGE_SIZE

  const handleConfigureModel = (modelName: string) => {
    setCurrentRow({ model_name: modelName } as any)
    setOpen('create-model')
  }

  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setCurrentPage(1)
    }
  }, [open])

  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) {
      return missingModels
    }
    const keyword = searchTerm.toLowerCase().trim()
    return missingModels.filter((modelName) =>
      modelName.toLowerCase().includes(keyword)
    )
  }, [missingModels, searchTerm])

  const totalItems = filteredModels.length
  const totalPages =
    totalItems === 0 ? 1 : Math.ceil(totalItems / Math.max(1, pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages))
    }
  }, [currentPage, totalPages])

  const paginatedModels = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredModels.slice(startIndex, endIndex)
  }, [filteredModels, currentPage, pageSize])

  const displayStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const displayEnd =
    totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems)
  const showPagination = totalItems > pageSize

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='flex max-h-[85vh] max-w-2xl flex-col gap-3 p-4'
        onOpenAutoFocus={(event) => {
          if (isMobile) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader className='flex-shrink-0 text-start'>
          <DialogTitle>Missing Models</DialogTitle>
          <DialogDescription>
            Models that are being used but not configured in the system
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        ) : missingModels.length === 0 ? (
          <div className='text-muted-foreground py-12 text-center'>
            <p>No missing models found.</p>
            <p className='text-sm'>
              All models in use are properly configured.
            </p>
          </div>
        ) : (
          <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'>
            <div className='flex flex-shrink-0 items-center justify-between gap-3'>
              <div className='text-muted-foreground text-sm whitespace-nowrap'>
                Showing {displayStart}-{displayEnd} of {totalItems}
              </div>
              <div className='relative w-48'>
                <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder='Search models...'
                  className='pl-9'
                  aria-label='Search missing models'
                />
              </div>
            </div>

            {filteredModels.length === 0 ? (
              <Empty className='border'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <Search className='h-5 w-5' />
                  </EmptyMedia>
                  <EmptyTitle>No matches found</EmptyTitle>
                  <EmptyDescription>
                    Try adjusting your search to locate a missing model.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className='flex-shrink-0 rounded-lg border'>
                <div className='divide-y'>
                  {paginatedModels.map((modelName) => (
                    <div
                      key={modelName}
                      className='flex items-center justify-between gap-3 p-3'
                    >
                      <div className='min-w-0 flex-1'>
                        <StatusBadge
                          label={modelName}
                          variant='neutral'
                          copyText={modelName}
                        />
                      </div>
                      <Button
                        size='sm'
                        className='flex-shrink-0 gap-1'
                        onClick={() => handleConfigureModel(modelName)}
                      >
                        <Plus className='h-4 w-4' />
                        Configure
                      </Button>
                    </div>
                  ))}
                </div>

                <div className='bg-muted/40 flex items-center justify-between border-t px-3 py-2 text-sm'>
                  <div className='text-muted-foreground text-sm'>
                    Page {currentPage} of {totalPages}
                  </div>
                  {showPagination && (
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        aria-label='Previous page'
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                        disabled={currentPage === totalPages}
                        aria-label='Next page'
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
