import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MESSAGE_ACTION_BUTTON_STYLES } from '../constants'

interface MessageActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'destructive'
}

export function MessageActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  className = '',
  variant = 'default',
}: MessageActionButtonProps) {
  const baseStyle =
    variant === 'destructive'
      ? MESSAGE_ACTION_BUTTON_STYLES.DELETE
      : MESSAGE_ACTION_BUTTON_STYLES.BASE

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className={`${baseStyle} ${className}`}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          <Icon className={MESSAGE_ACTION_BUTTON_STYLES.ICON} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}
