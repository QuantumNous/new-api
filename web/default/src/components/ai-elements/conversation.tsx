'use client'

import { type ComponentProps, useCallback } from 'react'
import { ArrowDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type ConversationProps = ComponentProps<typeof StickToBottom>

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn('relative flex-1 overflow-y-auto', className)}
    initial='smooth'
    resize='smooth'
    role='log'
    {...props}
  />
)

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content className={cn('p-4', className)} {...props} />
)

export type ConversationEmptyStateProps = ComponentProps<'div'> & {
  title?: string
  description?: string
  icon?: React.ReactNode
}

export const ConversationEmptyState = ({
  className,
  title,
  description,
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('No messages yet')
  const resolvedDescription =
    description ?? t('Start a conversation to see messages here')

  return (
    <div
      className={cn(
        'flex size-full flex-col items-center justify-center gap-3 p-8 text-center',
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          {icon && <div className='text-muted-foreground'>{icon}</div>}
          <div className='space-y-1'>
            <h3 className='text-sm font-medium'>{resolvedTitle}</h3>
            {resolvedDescription && (
              <p className='text-muted-foreground text-sm'>
                {resolvedDescription}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export type ConversationScrollButtonProps = ComponentProps<typeof Button>

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom()
  }, [scrollToBottom])

  return (
    !isAtBottom && (
      <Button
        className={cn(
          'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
          className
        )}
        onClick={handleScrollToBottom}
        size='icon'
        type='button'
        variant='outline'
        aria-label='Scroll to bottom'
        {...props}
      >
        <ArrowDownIcon className='size-4' aria-hidden='true' />
      </Button>
    )
  )
}
