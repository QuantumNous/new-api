import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CopyButton } from '@/components/copy-button'

interface MaskedValueDisplayProps {
  /** 弹层内标题，如 "Full API Key" / "Full Code" */
  label: string
  /** 完整值，在 Popover 内完整展示 */
  fullValue: string
  /** 表格内显示的脱敏值 */
  maskedValue: string
  /** 复制按钮的 tooltip */
  copyTooltip: string
  /** 复制按钮的 aria-label */
  copyAriaLabel: string
}

/**
 * 用于在表格中展示脱敏密钥/兑换码：点击显示完整内容（文本块完整显示，非 Input），支持一键复制。
 */
export function MaskedValueDisplay(props: MaskedValueDisplayProps) {
  return (
    <div className='flex items-center'>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='ghost' size='sm' className='h-7 font-mono'>
            {props.maskedValue}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className='w-auto max-w-[min(90vw,28rem)]'
          align='start'
        >
          <div className='space-y-2'>
            <p className='text-muted-foreground text-xs'>{props.label}</p>
            <pre
              className='bg-muted/50 max-h-[50vh] overflow-auto rounded-md border px-3 py-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap'
              style={{ wordBreak: 'break-all' }}
            >
              {props.fullValue}
            </pre>
          </div>
        </PopoverContent>
      </Popover>
      <CopyButton
        value={props.fullValue}
        className='size-7'
        iconClassName='size-3.5'
        tooltip={props.copyTooltip}
        aria-label={props.copyAriaLabel}
      />
    </div>
  )
}
