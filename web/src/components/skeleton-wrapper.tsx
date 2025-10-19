import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonWrapperProps {
  loading?: boolean
  type?:
    | 'text'
    | 'title'
    | 'image'
    | 'avatar'
    | 'navigation'
    | 'button'
    | 'userArea'
  width?: number | string
  height?: number | string
  count?: number
  className?: string
  children?: React.ReactNode
}

export function SkeletonWrapper({
  loading = false,
  type = 'text',
  width = 60,
  height = 16,
  count = 1,
  className = '',
  children,
}: SkeletonWrapperProps) {
  if (!loading) {
    return children
  }

  const getWidthClass = () => {
    if (typeof width === 'number') {
      return { width: `${width}px` }
    }
    return { width }
  }

  const getHeightClass = () => {
    if (typeof height === 'number') {
      return { height: `${height}px` }
    }
    return { height }
  }

  // 图片骨架屏（用于 Logo）
  const renderImageSkeleton = () => {
    return (
      <Skeleton
        className={cn('absolute inset-0 rounded-full', className)}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }

  // 标题骨架屏（用于系统名称）
  const renderTitleSkeleton = () => {
    return (
      <Skeleton
        className={className}
        style={{ ...getWidthClass(), height: 24 }}
      />
    )
  }

  // 导航链接骨架屏
  const renderNavigationSkeleton = () => {
    return (
      <>
        {Array(count)
          .fill(null)
          .map((_, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-1 rounded-md p-2',
                className
              )}
            >
              <Skeleton style={{ ...getWidthClass(), ...getHeightClass() }} />
            </div>
          ))}
      </>
    )
  }

  // 头像骨架屏
  const renderAvatarSkeleton = () => {
    return (
      <Skeleton
        className={cn('rounded-full', className)}
        style={{ width: 32, height: 32 }}
      />
    )
  }

  // 用户区域骨架屏 (头像 + 文本)
  const renderUserAreaSkeleton = () => {
    return (
      <div
        className={cn('flex items-center gap-2 rounded-full p-1', className)}
      >
        <Skeleton className='rounded-full' style={{ width: 24, height: 24 }} />
        <Skeleton style={{ width: 60, height: 12 }} />
      </div>
    )
  }

  // 按钮骨架屏
  const renderButtonSkeleton = () => {
    return (
      <Skeleton
        className={cn('rounded-md', className)}
        style={{ ...getWidthClass(), ...getHeightClass() }}
      />
    )
  }

  // 通用文本骨架屏
  const renderTextSkeleton = () => {
    return (
      <Skeleton
        className={className}
        style={{ ...getWidthClass(), ...getHeightClass() }}
      />
    )
  }

  // 根据类型渲染不同的骨架屏
  switch (type) {
    case 'image':
      return renderImageSkeleton()
    case 'title':
      return renderTitleSkeleton()
    case 'navigation':
      return renderNavigationSkeleton()
    case 'avatar':
      return renderAvatarSkeleton()
    case 'userArea':
      return renderUserAreaSkeleton()
    case 'button':
      return renderButtonSkeleton()
    case 'text':
    default:
      return renderTextSkeleton()
  }
}
