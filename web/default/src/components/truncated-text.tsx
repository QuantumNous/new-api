import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TruncatedTextProps {
  text: string
  className?: string
  maxWidth?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function TruncatedText({
  text,
  className,
  maxWidth = 'max-w-[200px]',
  side = 'top',
}: TruncatedTextProps) {
  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className={cn('block truncate', maxWidth, className)} />
          }
        >
          {text}
        </TooltipTrigger>
        <TooltipContent side={side} className='max-w-xs break-all'>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
