import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PanelWrapperProps {
  /** Panel title (element with icon) */
  title: ReactNode
  /** Whether in loading state */
  loading?: boolean
  /** Whether in empty state */
  empty?: boolean
  /** Empty state message */
  emptyMessage?: string
  /** Content area height (for loading and empty states) */
  height?: string
  /** Optional header action buttons */
  headerActions?: ReactNode
  /** Normal state content */
  children?: ReactNode
}

/**
 * Unified panel wrapper - handles loading/empty/normal states
 */
export function PanelWrapper({
  title,
  loading = false,
  empty = false,
  emptyMessage,
  height = 'h-64',
  headerActions,
  children,
}: PanelWrapperProps) {
  const { t } = useTranslation()
  const resolvedEmptyMessage = emptyMessage ?? t('No data available')

  // Loading state - return card with skeleton
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className={`w-full ${height}`} />
        </CardContent>
      </Card>
    )
  }

  // Empty state - return card with empty message
  if (empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-muted-foreground flex items-center justify-center ${height}`}
          >
            {resolvedEmptyMessage}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Normal state - return full card structure
  return (
    <Card>
      <CardHeader>
        {headerActions ? (
          <div className='flex items-center justify-between'>
            <CardTitle>{title}</CardTitle>
            {headerActions}
          </div>
        ) : (
          <CardTitle>{title}</CardTitle>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
