import { Monitor, Sun, MoonStar } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'

export function ThemeQuickSwitcher() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className='px-2 pt-1.5 pb-1'>
      <div className='flex w-full items-center justify-between gap-3'>
        <span
          id='theme-switcher-label'
          className='text-muted-foreground text-sm select-none'
        >
          {t('Theme')}
        </span>
        <div
          role='radiogroup'
          aria-labelledby='theme-switcher-label'
          className='border-muted/50 bg-muted/40 inline-flex w-auto items-center gap-1.5 rounded-full border px-1.5 py-1'
        >
          <Button
            variant='ghost'
            size='icon'
            role='radio'
            aria-label={t('System')}
            aria-checked={theme === 'system'}
            onClick={() => setTheme('system')}
            className={cn(
              'relative size-7 rounded-full',
              theme === 'system' && 'text-accent-foreground'
            )}
          >
            {theme === 'system' && (
              <motion.span
                layoutId='theme-switcher-active'
                className='bg-accent ring-border absolute inset-0 rounded-full ring-1'
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 0.2,
                }}
                animate={{ rotate: 360 }}
              />
            )}
            <Monitor className='relative z-10 size-[0.95rem]' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            role='radio'
            aria-label={t('Light')}
            aria-checked={theme === 'light'}
            onClick={() => setTheme('light')}
            className={cn(
              'relative size-7 rounded-full',
              theme === 'light' && 'text-accent-foreground'
            )}
          >
            {theme === 'light' && (
              <motion.span
                layoutId='theme-switcher-active'
                className='bg-accent ring-border absolute inset-0 rounded-full ring-1'
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 0.2,
                }}
                animate={{ rotate: 360 }}
              />
            )}
            <Sun className='relative z-10 size-[0.95rem]' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            role='radio'
            aria-label={t('Dark')}
            aria-checked={theme === 'dark'}
            onClick={() => setTheme('dark')}
            className={cn(
              'relative size-7 rounded-full',
              theme === 'dark' && 'text-accent-foreground'
            )}
          >
            {theme === 'dark' && (
              <motion.span
                layoutId='theme-switcher-active'
                className='bg-accent ring-border absolute inset-0 rounded-full ring-1'
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 0.2,
                }}
                animate={{ rotate: 360 }}
              />
            )}
            <MoonStar className='relative z-10 size-[0.95rem]' />
          </Button>
        </div>
      </div>
    </div>
  )
}
