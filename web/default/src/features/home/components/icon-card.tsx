import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

interface IconCardProps {
  iconName: string
  size?: number
  className?: string
}

/**
 * Reusable icon card component with glass morphism effect
 */
export function IconCard({ iconName, size = 32, className }: IconCardProps) {
  return (
    <div
      className={cn(
        'glass-morphism group/card border-border/50 dark:border-border/20',
        'relative overflow-hidden rounded-2xl border p-5',
        'transition-all duration-500 hover:scale-105',
        className
      )}
    >
      <div className='absolute -top-8 left-1/2 h-16 w-32 -translate-x-1/2 rounded-full bg-radial from-amber-500/10 to-amber-500/0 opacity-0 blur-xl transition-opacity duration-500 group-hover/card:opacity-100' />
      <div className='relative flex items-center justify-center'>
        {getLobeIcon(iconName, size)}
      </div>
    </div>
  )
}
