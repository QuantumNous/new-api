import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { TopNavLink } from '../types'

interface NavLinkItemProps {
  link: TopNavLink
  className?: string
}

/**
 * Renders a single navigation link (internal or external)
 * Handles routing and proper link attributes
 */
export function NavLinkItem({ link, className }: NavLinkItemProps) {
  const linkClassName = cn(
    'text-muted-foreground hover:text-foreground transition-colors',
    link.disabled && 'pointer-events-none opacity-50',
    className
  )

  if (link.external) {
    return (
      <a
        href={link.href}
        target='_blank'
        rel='noopener noreferrer'
        className={linkClassName}
        aria-disabled={link.disabled}
      >
        {link.title}
      </a>
    )
  }

  return (
    <Link to={link.href} className={linkClassName} disabled={link.disabled}>
      {link.title}
    </Link>
  )
}

interface NavLinkListProps {
  links: TopNavLink[]
  className?: string
  itemClassName?: string
}

/**
 * Renders a list of navigation links
 * Used in both desktop and mobile navigation
 */
export function NavLinkList({
  links,
  className,
  itemClassName,
}: NavLinkListProps) {
  return (
    <>
      {links.map((link, index) => (
        <NavLinkItem
          key={index}
          link={link}
          className={cn(className, itemClassName)}
        />
      ))}
    </>
  )
}
