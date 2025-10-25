import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusBadge } from '@/components/status-badge'
import { getMissingModels } from '../../api'
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

  const { data, isLoading } = useQuery({
    queryKey: modelsQueryKeys.missing(),
    queryFn: getMissingModels,
    enabled: open,
  })

  const missingModels = data?.data || []

  const handleConfigureModel = (modelName: string) => {
    setCurrentRow({ model_name: modelName } as any)
    setOpen('create-model')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
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
          <ScrollArea className='max-h-96'>
            <div className='space-y-2'>
              {missingModels.map((modelName) => (
                <div
                  key={modelName}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <StatusBadge
                    label={modelName}
                    variant='neutral'
                    copyText={modelName}
                  />
                  <Button
                    size='sm'
                    onClick={() => handleConfigureModel(modelName)}
                  >
                    <Plus className='h-4 w-4' />
                    Configure
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
