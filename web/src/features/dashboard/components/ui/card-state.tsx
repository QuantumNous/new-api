import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CardStateProps {
  /**
   * 卡片标题，支持字符串或 React 元素
   */
  title?: ReactNode
  /**
   * 内容区域高度，默认 h-80
   */
  height?: string
  /**
   * 状态内容（加载提示、空状态文本等）
   */
  children: ReactNode
}

/**
 * 通用卡片状态组件 - 用于显示加载、空状态或错误信息
 * 内容会自动居中显示
 */
export function CardState({
  title,
  height = 'h-80',
  children,
}: CardStateProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div
          className={`text-muted-foreground flex items-center justify-center ${height}`}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  )
}
