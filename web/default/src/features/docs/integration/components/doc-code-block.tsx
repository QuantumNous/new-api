import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/utils'

type DocCodeBlockProps = {
  code: string
  language?: string
  filename?: string
  className?: string
}

export function DocCodeBlock(props: DocCodeBlockProps) {
  return (
    <div
      className={cn(
        'bg-muted/40 dark:bg-muted/20 relative overflow-x-auto rounded-lg border',
        props.className
      )}
    >
      {props.filename ? (
        <div className='border-b bg-muted/60 dark:bg-muted/40 text-muted-foreground px-4 py-2 font-mono text-xs'>
          {props.filename}
        </div>
      ) : null}
      <CopyButton
        value={props.code}
        className='absolute top-2 right-2 z-10'
        size='icon'
        variant='ghost'
      />
      <pre className='overflow-x-auto p-4 pr-12 text-sm leading-relaxed'>
        <code className='font-mono text-foreground'>{props.code}</code>
      </pre>
    </div>
  )
}
