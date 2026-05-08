import { CircleQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type LearnMoreProps = Omit<React.ComponentProps<typeof Popover>, 'children'> & {
  children?: React.ReactNode
  contentProps?: React.ComponentProps<typeof PopoverContent>
  triggerProps?: React.ComponentProps<typeof PopoverTrigger>
}

export function LearnMore({
  children,
  contentProps,
  triggerProps,
  ...props
}: LearnMoreProps) {
  const { t } = useTranslation()
  return (
    <Popover {...props}>
      <PopoverTrigger
        {...triggerProps}
        className={cn('size-5 rounded-full', triggerProps?.className)}
        render={<Button variant='outline' size='icon' />}
      >
        <span className='sr-only'>{t('Learn more')}</span>
        <CircleQuestionMark className='size-4 [&>circle]:hidden' />
      </PopoverTrigger>
      <PopoverContent
        side='top'
        align='start'
        {...contentProps}
        className={cn('text-muted-foreground text-sm', contentProps?.className)}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
