import { memo } from 'react'
import { Separator } from '@/components/ui/separator'

type SettingsSectionProps = {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export const SettingsSection = memo(function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={className}>
      <div className='mb-4'>
        <h3 className='text-lg font-medium'>{title}</h3>
        {description && (
          <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
        )}
      </div>
      <Separator className='my-4' />
      <div className='space-y-4'>{children}</div>
    </div>
  )
})
