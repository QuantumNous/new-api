/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FooterSocialIcon } from '@/features/footer/components/footer-social-icon'
import {
  parseFooterConfig,
  type FooterSocialIconName,
  type FooterRegistration,
} from '@/features/footer/types'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

interface FooterLink {
  id?: string
  text: string
  href: string
  translate?: boolean
}

interface FooterColumnProps {
  id?: string
  title: string
  links: FooterLink[]
  translate?: boolean
}

interface FooterSocialLink {
  id?: string
  label: string
  href: string
  icon: FooterSocialIconName
}

interface FooterProps {
  logo?: string
  name?: string
  columns?: FooterColumnProps[]
  copyright?: string
  className?: string
}

const NEW_API_FOOTER_ATTRIBUTION_KEY = [
  'footer',
  'new' + 'api',
  'projectAttributionSuffix',
].join('.')

const socialLinks: FooterSocialLink[] = [
  {
    label: 'GitHub',
    href: 'https://github.com/QuantumNous/new-api',
    icon: 'github',
  },
  {
    label: 'Documentation',
    href: 'https://docs.newapi.pro',
    icon: 'documentation',
  },
  {
    label: 'Discord',
    href: 'https://docs.newapi.pro/support/community-interaction/',
    icon: 'discord',
  },
  {
    label: 'Telegram',
    href: 'https://docs.newapi.pro/support/community-interaction/',
    icon: 'telegram',
  },
  {
    label: 'Email',
    href: 'mailto:support@quantumnous.com',
    icon: 'email',
  },
]

function FooterLinkItem(props: { link: FooterLink }) {
  const { t } = useTranslation()
  const isExternal = /^(?:https?:|mailto:)/i.test(props.link.href)
  const label =
    props.link.translate === false ? props.link.text : t(props.link.text)

  if (isExternal) {
    const opensNewTab = /^https?:/i.test(props.link.href)
    return (
      <a
        href={props.link.href}
        target={opensNewTab ? '_blank' : undefined}
        rel={opensNewTab ? 'noopener noreferrer' : undefined}
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

function FooterSocialLinks(props: { links: FooterSocialLink[] }) {
  return (
    <div className='flex flex-wrap items-center gap-2.5'>
      {props.links.map((item) => {
        const opensNewTab = /^https?:/i.test(item.href)
        return (
          <a
            key={item.id ?? `${item.label}-${item.href}`}
            href={item.href}
            target={opensNewTab ? '_blank' : undefined}
            rel={opensNewTab ? 'noopener noreferrer' : undefined}
            aria-label={item.label}
            title={item.label}
            className='border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary hover:text-primary-foreground flex size-9 items-center justify-center rounded-full border shadow-sm transition-all duration-200 hover:-translate-y-0.5'
          >
            <FooterSocialIcon name={item.icon} />
          </a>
        )
      })}
    </div>
  )
}

// Renders User Agreement / Privacy Policy links inline with the parent's
// copyright row when either is configured in System Settings → Site. Emits
// fragmented siblings so the parent flex container's gap controls spacing.
function LegalLinks(props: {
  leadingSeparator?: boolean
  userAgreementEnabled?: boolean
  privacyPolicyEnabled?: boolean
}) {
  const { t } = useTranslation()
  const items: { key: string; label: string; href: string }[] = []
  if (props.userAgreementEnabled) {
    items.push({
      key: 'user-agreement',
      label: t('User Agreement'),
      href: '/user-agreement',
    })
  }
  if (props.privacyPolicyEnabled) {
    items.push({
      key: 'privacy-policy',
      label: t('Privacy Policy'),
      href: '/privacy-policy',
    })
  }
  if (items.length === 0) {
    return null
  }
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {(props.leadingSeparator || index > 0) && (
            <span aria-hidden='true' className='text-muted-foreground/30'>
              ·
            </span>
          )}
          <Link
            to={item.href}
            className='hover:text-foreground transition-colors duration-200'
          >
            {item.label}
          </Link>
        </Fragment>
      ))}
    </>
  )
}

// inline=true returns just the inner span for composition in a parent flex
// row. inline=false wraps in a centered/right-aligned div (default).
function ProjectAttribution(props: { currentYear: number; inline?: boolean }) {
  const { t } = useTranslation()
  const content = (
    <span className='text-muted-foreground/45'>
      &copy; {props.currentYear}{' '}
      <a
        href='https://github.com/QuantumNous/new-api'
        target='_blank'
        rel='noopener noreferrer'
        className='text-foreground/70 hover:text-foreground font-medium transition-colors'
      >
        {t('New API')}
      </a>
      . {t(NEW_API_FOOTER_ATTRIBUTION_KEY)}
    </span>
  )
  if (props.inline) {
    return content
  }
  return (
    <div className='text-muted-foreground/45 text-center text-xs sm:text-right'>
      {content}
    </div>
  )
}

function RegistrationLinks(props: { records: FooterRegistration[] }) {
  if (props.records.length === 0) return null
  return (
    <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium sm:justify-start'>
      {props.records.map((record) => (
        <a
          key={record.id}
          href={record.url}
          target='_blank'
          rel='noopener noreferrer'
          className='hover:text-foreground inline-flex max-w-full items-center gap-2'
        >
          {record.icon && (
            <img
              src={record.icon}
              alt=''
              className='size-5 shrink-0 object-contain'
            />
          )}
          <span className='break-words'>{record.label}</span>
        </a>
      ))}
    </div>
  )
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const { systemName, logo: systemLogo, footerHtml } = useSystemConfig()
  const { status } = useStatus()

  const displayLogo = systemLogo || props.logo || '/logo.png'
  const displayName = systemName || props.name || 'New API'
  const currentYear = new Date().getFullYear()
  const configuredFooter = useMemo(
    () => parseFooterConfig(status?.footer_config),
    [status?.footer_config]
  )

  const fallbackColumns = useMemo<FooterColumnProps[]>(
    () => [
      {
        title: 'footer.columns.product.title',
        links: [
          {
            text: 'footer.columns.product.links.capabilities',
            href: '/#platform',
          },
          {
            text: 'footer.columns.product.links.models',
            href: '/#models',
          },
          {
            text: 'footer.columns.product.links.playground',
            href: '/playground',
          },
          {
            text: 'footer.columns.product.links.wallet',
            href: '/wallet',
          },
        ],
      },
      {
        title: 'footer.columns.docs.title',
        links: [
          {
            text: 'footer.columns.docs.links.quickStart',
            href: 'https://docs.newapi.pro/getting-started/',
          },
          {
            text: 'footer.columns.docs.links.apiDocs',
            href: 'https://docs.newapi.pro/api/',
          },
          {
            text: 'footer.columns.docs.links.modelPricing',
            href: '/pricing',
          },
        ],
      },
      {
        title: 'footer.columns.resources.title',
        links: [
          {
            text: 'footer.columns.resources.links.projectIntro',
            href: 'https://docs.newapi.pro/wiki/project-introduction/',
          },
          {
            text: 'footer.columns.resources.links.deployment',
            href: 'https://docs.newapi.pro/installation/',
          },
          {
            text: 'footer.columns.resources.links.keyTool',
            href: 'https://github.com/Calcium-Ion/new-api-key-tool',
          },
        ],
      },
      {
        title: 'footer.columns.community.title',
        links: [
          {
            text: 'footer.columns.community.links.github',
            href: 'https://github.com/QuantumNous/new-api',
          },
          {
            text: 'footer.columns.community.links.issues',
            href: 'https://github.com/QuantumNous/new-api/issues',
          },
          {
            text: 'footer.columns.community.links.channels',
            href: 'https://docs.newapi.pro/support/community-interaction/',
          },
        ],
      },
    ],
    []
  )

  const configuredColumns = useMemo<FooterColumnProps[] | null>(
    () =>
      configuredFooter
        ? configuredFooter.columns.map((column) => ({
            id: column.id,
            title: column.title,
            translate: false,
            links: column.links.map((link) => ({
              id: link.id,
              text: link.label,
              href: link.url,
              translate: false,
            })),
          }))
        : null,
    [configuredFooter]
  )
  const configuredSocialLinks = useMemo<FooterSocialLink[] | null>(
    () =>
      configuredFooter
        ? configuredFooter.socialLinks.map((link) => ({
            id: link.id,
            label: link.label,
            href: link.url,
            icon: link.icon,
          }))
        : null,
    [configuredFooter]
  )
  const footerColumns = props.columns ?? configuredColumns ?? fallbackColumns
  const footerSocialLinks = configuredSocialLinks ?? socialLinks
  const footerDescription =
    configuredFooter?.description ?? t('Powerful API Management Platform')

  if (footerHtml) {
    return (
      <footer
        className={cn(
          'border-border/40 relative z-10 border-t',
          props.className
        )}
      >
        <div className='mx-auto w-full max-w-6xl px-6 py-5'>
          <div className='bg-muted/20 border-border/50 flex flex-col items-center justify-between gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm sm:flex-row sm:px-5'>
            <div
              className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
            <FooterSocialLinks links={footerSocialLinks} />
            <div
              data-slot='footer-legal'
              className='border-border/60 text-muted-foreground/45 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-xs sm:w-auto sm:justify-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5'
            >
              <LegalLinks
                userAgreementEnabled={status?.user_agreement_enabled}
                privacyPolicyEnabled={status?.privacy_policy_enabled}
              />
              <ProjectAttribution currentYear={currentYear} inline />
              <RegistrationLinks
                records={configuredFooter?.registrations ?? []}
              />
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={cn(
        'border-border/60 bg-background text-foreground relative z-10 border-t',
        props.className
      )}
    >
      <div className='mx-auto max-w-6xl px-6 py-14 md:py-18'>
        <div className='grid gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)]'>
          <div className='max-w-sm'>
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
              {footerDescription}
            </p>
            <div className='mt-6'>
              <FooterSocialLinks links={footerSocialLinks} />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4'>
            {footerColumns.map((column) => (
              <div key={column.id ?? column.title}>
                <p className='text-foreground mb-4 text-xs font-semibold tracking-[0.16em] uppercase'>
                  {column.translate === false ? column.title : t(column.title)}
                </p>
                <ul className='space-y-3'>
                  {column.links.map((link) => (
                    <li
                      key={
                        link.id ?? `${column.title}-${link.text}-${link.href}`
                      }
                    >
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright + optional legal links inline on the left, project
            attribution on the right; wraps on narrow screens. */}
        <div
          data-slot='footer-legal'
          className='border-border/30 mt-12 flex flex-col items-center justify-between gap-x-3 gap-y-2 border-t pt-6 sm:flex-row'
        >
          <div className='min-w-0 space-y-2'>
            <div className='text-muted-foreground/40 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:justify-start'>
              <span>
                &copy; {currentYear} {displayName}.{' '}
                {props.copyright ?? t('footer.defaultCopyright')}
              </span>
              <LegalLinks
                leadingSeparator
                userAgreementEnabled={status?.user_agreement_enabled}
                privacyPolicyEnabled={status?.privacy_policy_enabled}
              />
            </div>
            <RegistrationLinks
              records={configuredFooter?.registrations ?? []}
            />
          </div>
          <ProjectAttribution currentYear={currentYear} />
        </div>
      </div>
    </footer>
  )
}
