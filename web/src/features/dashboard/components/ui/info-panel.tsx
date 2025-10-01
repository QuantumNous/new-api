import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CardState } from './card-state'

interface InfoPanelProps {
  title: ReactNode
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
  if (loading) {
    return <CardState title={title} height={height} loading={true} />
  }

  if (!items.length) {
    return (
      <CardState title={title} height={height}>
        {emptyMessage}
      </CardState>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={height}>
          <div className='space-y-2 pe-4'>
            {items.map((item, idx) => renderItem(item, idx))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
