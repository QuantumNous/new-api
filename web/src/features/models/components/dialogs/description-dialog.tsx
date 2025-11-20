import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

type DescriptionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  modelName: string
  description: string
}

export function DescriptionDialog({
  open,
  onOpenChange,
  modelName,
  description,
}: DescriptionDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{modelName}</DialogTitle>
          <DialogDescription>{t('Model Description')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-96'>
          <div className='space-y-2 pr-4'>
            <p className='text-foreground text-sm leading-relaxed break-words whitespace-pre-wrap'>
              {description}
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
