type SettingsSectionProps = {
  title: string
  titleProps?: React.HTMLAttributes<HTMLHeadingElement>
  description?: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  title,
  titleProps,
  description,
  children,
  className,
}: SettingsSectionProps) {
  const baseClassName = 'space-y-4'
  const sectionClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName

  return (
    <section className={sectionClassName}>
      <div className='space-y-1'>
        <h3
          {...titleProps}
          className={
            titleProps?.className
              ? `text-base font-semibold ${titleProps.className}`
              : 'text-base font-semibold'
          }
        >
          {title}
        </h3>
        {description && (
          <p className='text-muted-foreground text-sm'>{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}
