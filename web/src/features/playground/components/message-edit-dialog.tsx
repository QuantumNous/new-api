import { memo, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

interface MessageEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialContent: string
  title?: string
  description?: string
  onSave: (newContent: string) => void
}

function MessageEditDialogComponent({
  open,
  onOpenChange,
  initialContent,
  title = 'Edit Message',
  description = 'Modify the message content below',
  onSave,
}: MessageEditDialogProps) {
  const [content, setContent] = useState(initialContent)

  // Reset local state when dialog opens or initialContent changes
  useEffect(() => {
    if (open) setContent(initialContent)
  }, [open, initialContent])

  const isChanged = useMemo(
    () => content !== initialContent,
    [content, initialContent]
  )
  const isEmpty = useMemo(() => content.trim().length === 0, [content])

  const handleSave = () => {
    if (!isChanged) return onOpenChange(false)
    onSave(content)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[60vh] pr-4'>
          <div className='space-y-2'>
            <Textarea
              id='message-content'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className='resize-none font-mono text-sm'
              placeholder='Enter message content...'
            />
          </div>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isEmpty || !isChanged}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const MessageEditDialog = memo(MessageEditDialogComponent)
