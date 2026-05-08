import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { AutoSkeleton } from 'auto-skeleton-react'
import { ErrorState } from '@/components/error-state'

interface ContentSkeletonProps {
  loading: boolean
  children: ReactNode
  borderRadius?: number
  minTextHeight?: number
  maxDepth?: number
  className?: string
}

export function ContentSkeleton(props: ContentSkeletonProps) {
  return (
    <div className={props.className}>
      <AutoSkeleton
        loading={props.loading}
        config={{
          animation: 'none',
          baseColor: 'var(--skeleton-base)',
          highlightColor: 'var(--skeleton-highlight)',
          borderRadius: props.borderRadius ?? 6,
          minTextHeight: props.minTextHeight ?? 14,
          maxDepth: props.maxDepth ?? 10,
        }}
      >
        {props.children}
      </AutoSkeleton>
    </div>
  )
}

interface QuerySkeletonProps {
  query: UseQueryResult<unknown, unknown>
  children: ReactNode
  className?: string
  errorTitle?: string
  errorDescription?: string
}

export function QuerySkeleton(props: QuerySkeletonProps) {
  if (props.query.isError) {
    return (
      <ErrorState
        title={props.errorTitle}
        description={props.errorDescription}
        onRetry={() => props.query.refetch()}
      />
    )
  }

  return (
    <ContentSkeleton
      loading={props.query.isLoading}
      className={props.className}
    >
      {props.children}
    </ContentSkeleton>
  )
}
