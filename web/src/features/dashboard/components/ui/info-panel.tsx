import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface InfoPanelProps {
  title: string
  items: any[]
  emptyMessage?: string
  loading?: boolean
  height?: string
  renderItem: (item: any, index: number) => ReactNode
}

export function InfoPanel({
  title,
  items,
  emptyMessage = 'No data available.',
  loading = false,
  height = 'h-64',
  renderItem,
}: InfoPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={height}>
          <div className='space-y-2 pe-4'>
            {loading && (
              <div className='text-muted-foreground text-sm'>Loading...</div>
            )}
            {!loading && items.map((item, idx) => renderItem(item, idx))}
            {!loading && !items.length && (
              <div className='text-muted-foreground text-sm'>
                {emptyMessage}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
