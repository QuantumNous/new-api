import { formatDateTimeObject } from '@/lib/time'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'

interface AnnouncementDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  announcement: any
}

export function AnnouncementDetailModal({
  open,
  onOpenChange,
  announcement,
}: AnnouncementDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Announcement Details</DialogTitle>
          {announcement?.publishDate && (
            <DialogDescription>
              Published:{' '}
              {formatDateTimeObject(new Date(announcement.publishDate))}
            </DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className='max-h-[60vh] pr-4'>
          <div className='space-y-4'>
            {announcement?.content && (
              <div>
                <h4 className='mb-2 font-medium'>Content</h4>
                <Markdown>{announcement.content}</Markdown>
              </div>
            )}
            {announcement?.extra && (
              <div>
                <h4 className='mb-2 font-medium'>Additional Information</h4>
                <Markdown className='text-muted-foreground'>
                  {announcement.extra}
                </Markdown>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
