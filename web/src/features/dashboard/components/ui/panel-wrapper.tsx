import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PanelWrapperProps {
  /**
   * 面板标题（包含图标的元素）
   */
  title: ReactNode
  /**
   * 是否处于加载状态
   */
  loading?: boolean
  /**
   * 是否为空状态
   */
  empty?: boolean
  /**
   * 空状态提示文本
   */
  emptyMessage?: string
  /**
   * 内容区域高度（用于 loading 和 empty 状态）
   */
  height?: string
  /**
   * Header 右侧的操作按钮（可选）
   */
  headerActions?: ReactNode
  /**
   * 正常状态下的内容
   */
  children?: ReactNode
}

/**
 * 统一的面板包装组件 - 自动处理 loading/empty/normal 三种状态
 */
export function PanelWrapper({
  title,
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
  height = 'h-64',
  headerActions,
  children,
}: PanelWrapperProps) {
  // Loading state - 返回带骨架屏的卡片
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

  // Empty state - 返回带空状态提示的卡片
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
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Normal state - 返回完整的卡片结构
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
