import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

type SettingsAccordionProps = {
  value: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function SettingsAccordion({
  value,
  title,
  description,
  children,
  className,
}: SettingsAccordionProps) {
  return (
    <AccordionItem value={value} className={className}>
      <AccordionTrigger className='hover:no-underline'>
        <div className='flex flex-col gap-1 text-left'>
          <div className='text-base font-semibold'>{title}</div>
          {description && (
            <div className='text-muted-foreground text-sm'>{description}</div>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className='pt-4'>{children}</AccordionContent>
    </AccordionItem>
  )
}
