import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getMissingModels } from '../../api'
import { ERROR_MESSAGES } from '../../constants'
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
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: missingModels, isLoading } = useQuery({
    queryKey: ['missing-models'],
    queryFn: async () => {
      const result = await getMissingModels()
      if (!result.success) {
        toast.error(result.message || ERROR_MESSAGES.MISSING_MODELS_LOAD_FAILED)
        return []
      }
      return result.data || []
    },
    enabled: open,
  })

  const filteredModels = (missingModels || []).filter((model) =>
    model.toLowerCase().includes(searchKeyword.toLowerCase())
  )

  const totalPages = Math.ceil(filteredModels.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pagedModels = filteredModels.slice(startIndex, endIndex)

  const handleConfigure = (modelName: string) => {
    // Pass model_name as currentRow so the create drawer can pre-fill it
    setCurrentRow({ model_name: modelName } as any)
    setOpen('create-model')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[80vh] max-w-2xl flex-col'>
        <DialogHeader>
          <DialogTitle>Missing Models</DialogTitle>
          <DialogDescription>
            These models have been requested but are not yet configured.
            Configure them to enable usage.
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
          {isLoading ? (
            <div className='flex h-32 items-center justify-center'>
              <p className='text-muted-foreground'>Loading...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className='flex h-32 items-center justify-center'>
              <p className='text-muted-foreground'>
                {searchKeyword
                  ? 'No matching models found'
                  : 'No missing models'}
              </p>
            </div>
          ) : (
            <div className='flex-1 overflow-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model Name</TableHead>
                    <TableHead className='w-[120px]'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedModels.map((model) => (
                    <TableRow key={model}>
                      <TableCell className='font-medium'>{model}</TableCell>
                      <TableCell>
                        <Button
                          size='sm'
                          onClick={() => handleConfigure(model)}
                        >
                          Configure
                        </Button>
                      </TableCell>
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
                {Math.min(endIndex, filteredModels.length)} of{' '}
                {filteredModels.length} models
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
      </DialogContent>
    </Dialog>
  )
}
