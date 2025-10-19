import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
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
  logo?: string
  name?: string
  columns?: FooterColumnProps[]
  copyright?: string
  policies?: FooterLink[]
  showThemeToggle?: boolean
  className?: string
}

// Reusable link component that handles both internal and external links
function FooterLink({ link }: { link: FooterLink }) {
  const isExternal = link.href.startsWith('http')
  const className =
    'text-muted-foreground hover:text-foreground text-sm transition-colors'

  if (isExternal) {
    return (
      <a
        href={link.href}
        target='_blank'
        rel='noopener noreferrer'
        className={className}
      >
        {link.text}
      </a>
    )
  }

  return (
    <Link to={link.href} className={className}>
      {link.text}
    </Link>
  )
}

export function Footer({
  logo = '/logo.png',
  name = 'New API',
  columns = [
    {
      title: 'About Us',
      links: [
        {
          text: 'About Project',
          href: 'https://docs.newapi.pro/wiki/project-introduction/',
        },
        {
          text: 'Contact Us',
          href: 'https://docs.newapi.pro/support/community-interaction/',
        },
        {
          text: 'Features',
          href: 'https://docs.newapi.pro/wiki/features-introduction/',
        },
      ],
    },
    {
      title: 'Documentation',
      links: [
        {
          text: 'Quick Start',
          href: 'https://docs.newapi.pro/getting-started/',
        },
        {
          text: 'Installation Guide',
          href: 'https://docs.newapi.pro/installation/',
        },
        { text: 'API Documentation', href: 'https://docs.newapi.pro/api/' },
      ],
    },
    {
      title: 'Related Projects',
      links: [
        { text: 'One API', href: 'https://github.com/songquanpeng/one-api' },
        {
          text: 'Midjourney-Proxy',
          href: 'https://github.com/novicezk/midjourney-proxy',
        },
        {
          text: 'neko-api-key-tool',
          href: 'https://github.com/Calcium-Ion/neko-api-key-tool',
        },
      ],
    },
    {
      title: 'Friend Links',
      links: [
        {
          text: 'new-api-horizon',
          href: 'https://github.com/Calcium-Ion/new-api-horizon',
        },
        { text: 'CoAI', href: 'https://github.com/coaidev/coai' },
        { text: 'GPT-Load', href: 'https://www.gpt-load.com/' },
      ],
    },
  ],
  copyright = 'All rights reserved.',
  policies = [],
  showThemeToggle = false,
  className,
}: FooterProps) {
  const {
    systemName,
    logo: systemLogo,
    footerHtml,
    demoSiteEnabled,
  } = useSystemConfig()

  // Use system config with fallbacks
  const displayLogo = systemLogo || logo
  const displayName = systemName || name
  const isDemoSiteMode = Boolean(demoSiteEnabled)
  const currentYear = new Date().getFullYear()

  // If custom footer HTML is provided, render it
  if (footerHtml) {
    return (
      <div
        className='custom-footer w-full'
        dangerouslySetInnerHTML={{ __html: footerHtml }}
      />
    )
  }

  // Otherwise, render default footer
  return (
    <footer className={cn('bg-background w-full px-4', className)}>
      <div className='max-w-container mx-auto py-12'>
        {/* Demo Site Mode: Show full footer with links */}
        {isDemoSiteMode && (
          <div className='grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5'>
            {/* Logo Column */}
            <div className='col-span-2 flex flex-col gap-4 sm:col-span-3 md:col-span-1'>
              <div className='flex items-center gap-2'>
                <img
                  src={displayLogo}
                  alt={displayName}
                  className='h-6 w-6 rounded object-contain'
                />
                <h3 className='text-xl font-bold'>{displayName}</h3>
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
                    <FooterLink key={linkIndex} link={link} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Section: Always shown */}
        <div
          className={cn(
            'flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row',
            isDemoSiteMode && 'mt-8'
          )}
        >
          <div className='text-muted-foreground text-sm'>
            © {currentYear} {displayName}. {copyright}
          </div>
          <div className='flex items-center gap-2'>
            {policies.map((policy, index) => (
              <FooterLink key={index} link={policy} />
            ))}
            {showThemeToggle && <ThemeSwitch />}
            <span className='text-muted-foreground text-sm'>
              Designed and Developed by{' '}
            </span>
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary text-sm font-medium hover:underline'
            >
              New API
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
