import { Link } from '@tanstack/react-router'
import { Code } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeSwitch } from '@/components/theme-switch'

interface FooterLink {
  text: string
  href: string
}

interface FooterColumnProps {
  title: string
  links: FooterLink[]
}

interface FooterProps {
  logo?: React.ReactNode
  name?: string
  columns?: FooterColumnProps[]
  copyright?: string
  policies?: FooterLink[]
  showThemeToggle?: boolean
  className?: string
}

export function Footer({
  logo = <Code className='h-6 w-6' />,
  name = 'New API',
  columns = [
    {
      title: 'Product',
      links: [
        { text: 'Features', href: '/' },
        { text: 'Pricing', href: '/pricing' },
        { text: 'Changelog', href: '/' },
      ],
    },
    {
      title: 'Developers',
      links: [
        { text: 'API Documentation', href: '/' },
        { text: 'SDK Downloads', href: '/' },
        { text: 'Code Examples', href: '/' },
      ],
    },
    {
      title: 'Support',
      links: [
        { text: 'Help Center', href: '/' },
        { text: 'Contact Us', href: '/' },
        { text: 'Status Monitor', href: '/' },
      ],
    },
    {
      title: 'About',
      links: [
        { text: 'About Us', href: '/' },
        { text: 'Blog', href: '/' },
        { text: 'Github', href: '/' },
      ],
    },
  ],
  copyright = '© 2025 New API. All rights reserved.',
  policies = [
    { text: 'Privacy Policy', href: '/' },
    { text: 'Terms of Service', href: '/' },
  ],
  showThemeToggle = true,
  className,
}: FooterProps) {
  return (
    <footer className={cn('bg-background w-full border-t px-4', className)}>
      <div className='max-w-container mx-auto py-12'>
        <div className='grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5'>
          {/* Logo Column */}
          <div className='col-span-2 flex flex-col gap-4 sm:col-span-3 md:col-span-1'>
            <div className='flex items-center gap-2'>
              {logo}
              <h3 className='text-xl font-bold'>{name}</h3>
            </div>
            <p className='text-muted-foreground text-sm'>
              Powerful API Management Platform
            </p>
          </div>

          {/* Links Columns */}
          {columns.map((column, index) => (
            <div key={index} className='flex flex-col gap-4'>
              <h3 className='pt-1 text-sm font-semibold'>{column.title}</h3>
              <div className='flex flex-col gap-2'>
                {column.links.map((link, linkIndex) => (
                  <Link
                    key={linkIndex}
                    to={link.href}
                    className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                  >
                    {link.text}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className='mt-8 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row'>
          <div className='text-muted-foreground text-sm'>{copyright}</div>
          <div className='flex items-center gap-6'>
            {policies.map((policy, index) => (
              <Link
                key={index}
                to={policy.href}
                className='text-muted-foreground hover:text-foreground text-sm transition-colors'
              >
                {policy.text}
              </Link>
            ))}
            {showThemeToggle && <ThemeSwitch />}
          </div>
        </div>
      </div>
    </footer>
  )
}
