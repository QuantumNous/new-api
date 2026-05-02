import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'

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
  className?: string
}

function FooterLinkItem(props: { link: FooterLink }) {
  const { t } = useTranslation()
  const isExternal = props.link.href.startsWith('http')
  const label = t(props.link.text)

  if (isExternal) {
    return (
      <a
        href={props.link.href}
        target='_blank'
        rel='noopener noreferrer'
        className='text-muted-foreground hover:text-foreground text-sm transition-colors duration-200'
      >
        {label}
      </a>
    )
  }

  return (
    <Link
      to={props.link.href}
      className='text-muted-foreground hover:text-foreground text-sm transition-colors duration-200'
    >
      {label}
    </Link>
  )
}

function ProjectAttribution(props: { currentYear: number }) {
  return (
    <div className='text-muted-foreground/45 text-center text-xs sm:text-right'>
      <span className='text-muted-foreground/45'>
        &copy; {props.currentYear}{' '}
        <a
          href='https://github.com/NekoAIKan/aikanhub'
          target='_blank'
          rel='noopener noreferrer'
          className='text-foreground/70 font-medium transition-colors hover:text-foreground'
        >
          AIKanHub
        </a>
        {' · '}
        <a
          href='https://github.com/Calcium-Ion/new-api'
          target='_blank'
          rel='noopener noreferrer'
          className='text-muted-foreground/45 hover:text-muted-foreground transition-colors'
        >
          forked from new-api
        </a>
      </span>
    </div>
  )
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const {
    systemName,
    logo: systemLogo,
    footerHtml,
    demoSiteEnabled,
  } = useSystemConfig()

  const displayLogo = systemLogo || props.logo || '/logo.png'
  const displayName = systemName || props.name || 'AIKanHub'
  const isDemoSiteMode = Boolean(demoSiteEnabled)
  const currentYear = new Date().getFullYear()

  const fallbackColumns = useMemo<FooterColumnProps[]>(
    () => [
      {
        title: t('Product'),
        links: [
          { text: t('API Docs'), href: '/docs' },
          { text: t('Pricing'), href: '/docs#pricing' },
          { text: t('Models'), href: '/docs#models' },
        ],
      },
      {
        title: t('Account'),
        links: [
          { text: t('API Keys'), href: '/keys' },
          { text: t('Wallet'), href: '/wallet' },
          { text: t('Task Logs'), href: '/usage-logs/task' },
        ],
      },
      {
        title: t('Resources'),
        links: [
          { text: t('GitHub'), href: 'https://github.com/NekoAIKan/aikanhub' },
          { text: t('Status'), href: '/' },
          { text: t('Contact'), href: '/about' },
        ],
      },
    ],
    [t]
  )

  const displayColumns = props.columns ?? fallbackColumns

  if (footerHtml) {
    return (
      <footer className={cn('border-border/40 relative z-10 border-t', props.className)}>
        <div className='mx-auto w-full max-w-6xl px-6 py-5'>
          <div className='bg-muted/20 border-border/50 flex flex-col items-center justify-between gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm sm:flex-row sm:px-5'>
            <div
              className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
            <div className='border-border/60 w-full border-t pt-4 sm:w-auto sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5'>
              <ProjectAttribution currentYear={currentYear} />
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={cn('border-border/40 relative z-10 border-t', props.className)}
    >
      <div className='mx-auto max-w-6xl px-6 py-12 md:py-16'>
        <div className='flex flex-col justify-between gap-10 md:flex-row md:gap-16'>
          {/* Brand column */}
          <div className='shrink-0'>
            <Link to='/' className='group flex items-center gap-2.5'>
              <img
                src={displayLogo}
                alt={displayName}
                className='size-7 rounded-lg object-contain'
              />
              <span className='text-sm font-semibold tracking-tight'>
                {displayName}
              </span>
            </Link>
            <p className='text-muted-foreground/60 mt-3 max-w-[200px] text-xs leading-relaxed'>
              {t('Powerful API Management Platform')}
            </p>
          </div>

          {/* Links columns */}
          {isDemoSiteMode && (
            <div className='grid grid-cols-3 gap-8 md:gap-16'>
              {displayColumns.map((column, index) => (
                <div key={index}>
                  <p className='text-muted-foreground/50 mb-3 text-xs font-medium tracking-wider uppercase'>
                    {t(column.title)}
                  </p>
                  <ul className='space-y-2.5'>
                    {column.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <FooterLinkItem link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className='border-border/30 mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row'>
          <p className='text-muted-foreground/40 text-xs'>
            &copy; {currentYear} {displayName}.{' '}
            {props.copyright ?? t('footer.defaultCopyright')}
          </p>
          <ProjectAttribution currentYear={currentYear} />
        </div>
      </div>
    </footer>
  )
}
