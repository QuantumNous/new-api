import { type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  tooltip,
  successTooltip,
  'aria-label': ariaLabel,
}: CopyButtonProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const isCopied = copiedText === value
  const resolvedTooltip = tooltip ?? t('Copy to clipboard')
  const resolvedSuccessTooltip = successTooltip ?? t('Copied!')
  const resolvedAriaLabel = ariaLabel ?? resolvedTooltip
  const copiedAriaLabel = t('Copied')

  const button = (
    <Button
      variant={variant}
      size={size}
      className={cn('shrink-0', className)}
      onClick={() => copyToClipboard(value)}
      aria-label={isCopied ? copiedAriaLabel : resolvedAriaLabel}
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
          <p>{isCopied ? resolvedSuccessTooltip : resolvedTooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}
