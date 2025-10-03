import { type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CopyButtonProps {
  value: string
  children?: ReactNode
  className?: string
  iconClassName?: string
  variant?: 'ghost' | 'outline' | 'default' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  tooltip?: string
  successTooltip?: string
  'aria-label'?: string
}

export function CopyButton({
  value,
  children,
  className,
  iconClassName,
  variant = 'ghost',
  size = 'icon',
  tooltip = 'Copy to clipboard',
  successTooltip = 'Copied!',
  'aria-label': ariaLabel = 'Copy to clipboard',
}: CopyButtonProps) {
  const { copiedText, copyToClipboard } = useCopyToClipboard()
  const isCopied = copiedText === value

  const button = (
    <Button
      variant={variant}
      size={size}
      className={cn('shrink-0', className)}
      onClick={() => copyToClipboard(value)}
      aria-label={isCopied ? 'Copied' : ariaLabel}
    >
      {isCopied ? (
        <Check className={cn('text-green-600', iconClassName)} />
      ) : (
        <Copy className={cn(iconClassName)} />
      )}
      {children}
    </Button>
  )

  if (tooltip || successTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{isCopied ? successTooltip : tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}
