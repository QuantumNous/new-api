/*
Copyright (C) 2025 QuantumNous

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

import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@heroui/react';
import { getFooterHTML, getLogo, getSystemName } from '../../helpers';
import { StatusContext } from '../../context/Status';

// Shared link visual:
// - Inherits the muted/foreground tokens used in HeaderBar
// - No underline at rest *or* hover, no bold weight (per spec)
// - Hover only flips the color to primary, like nav items in HeaderBar
const linkClass =
  'text-muted no-underline hover:no-underline data-[hovered=true]:no-underline hover:text-primary data-[hovered=true]:text-primary';

// Single column inside the demo-site link grid. Pulled out so each
// column has identical visual rhythm and the parent can drive the
// whole grid from a data array.
const FooterLinkSection = ({ title, links }) => (
  <div className='text-left'>
    <p className='mb-3 text-sm text-foreground'>{title}</p>
    <ul className='flex flex-col gap-2.5'>
      {links.map((link) => (
        <li key={link.label}>
          <Link
            href={link.href}
            isExternal
            showAnchorIcon={false}
            size='sm'
            className={linkClass}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

// Bottom row shared between every render mode:
// "© Year SystemName · Designed & Developed by New API".
const FooterMeta = ({ systemName, currentYear, t }) => (
  <div className='flex w-full flex-col items-center justify-between gap-2 md:flex-row'>
    <span className='text-sm text-muted'>
      © {currentYear} {systemName}. {t('版权所有')}
    </span>
    <div className='text-sm text-muted'>
      <span>{t('设计与开发由')} </span>
      <Link
        href='https://github.com/QuantumNous/new-api'
        isExternal
        showAnchorIcon={false}
        size='sm'
        className={linkClass}
      >
        New API
      </Link>
    </div>
  </div>
);

const FooterBar = () => {
  const { t } = useTranslation();
  const [footer, setFooter] = useState(getFooterHTML());
  const systemName = getSystemName();
  const logo = getLogo();
  const [statusState] = useContext(StatusContext);
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setFooter(getFooterHTML());
  }, []);

  useEffect(() => {
    const nextFooter = statusState?.status?.footer_html;
    if (nextFooter) {
      setFooter(nextFooter);
      return;
    }
    setFooter(getFooterHTML());
  }, [statusState?.status?.footer_html]);

  // Centralised link config keeps the JSX flat and lets us edit copy /
  // URLs in one place. i18n keys are preserved verbatim so existing
  // translations under web/src/i18n/locales/* keep working.
  const sections = useMemo(
    () => [
      {
        title: t('关于我们'),
        links: [
          {
            label: t('关于项目'),
            href: 'https://docs.newapi.pro/wiki/project-introduction/',
          },
          {
            label: t('联系我们'),
            href: 'https://docs.newapi.pro/support/community-interaction/',
          },
          {
            label: t('功能特性'),
            href: 'https://docs.newapi.pro/wiki/features-introduction/',
          },
        ],
      },
      {
        title: t('文档'),
        links: [
          { label: t('快速开始'), href: 'https://docs.newapi.pro/getting-started/' },
          { label: t('安装指南'), href: 'https://docs.newapi.pro/installation/' },
          { label: t('API 文档'), href: 'https://docs.newapi.pro/api/' },
        ],
      },
      {
        title: t('相关项目'),
        links: [
          { label: 'One API', href: 'https://github.com/songquanpeng/one-api' },
          {
            label: 'Midjourney-Proxy',
            href: 'https://github.com/novicezk/midjourney-proxy',
          },
          {
            label: 'neko-api-key-tool',
            href: 'https://github.com/Calcium-Ion/neko-api-key-tool',
          },
        ],
      },
      {
        title: t('友情链接'),
        links: [
          {
            label: 'new-api-horizon',
            href: 'https://github.com/Calcium-Ion/new-api-horizon',
          },
          { label: 'CoAI', href: 'https://github.com/coaidev/coai' },
          { label: 'GPT-Load', href: 'https://www.gpt-load.com/' },
        ],
      },
    ],
    [t],
  );

  // Outer chrome mirrors HeaderBar's <Navbar maxWidth='full'>: same
  // background, same 1px hairline border (top instead of bottom),
  // same foreground/muted text tokens. The inner row uses the SAME
  // `px-2 md:px-4` horizontal padding as `Navbar.Header`, with NO
  // `max-w-*` constraint — that way the footer's left/right edges
  // line up pixel-perfectly with the header's edges across the
  // viewport (mobile and desktop).
  const shell =
    'w-full border-t border-border bg-background text-foreground';
  const innerPadX = 'px-2 md:px-4';

  // Custom HTML footer (configured by the admin in System settings).
  // Rendered in a single compact row, like HeaderBar — no decorative
  // background, no extra vertical padding.
  if (footer) {
    return (
      <div className={shell}>
        <div
          className={`flex w-full flex-col items-center justify-between gap-2 py-3 md:flex-row ${innerPadX}`}
        >
          <div
            className='custom-footer na-cb6feafeb3990c78 text-sm text-muted'
            dangerouslySetInnerHTML={{ __html: footer }}
          ></div>
          <div className='shrink-0 text-sm text-muted'>
            <span>{t('设计与开发由')} </span>
            <Link
              href='https://github.com/QuantumNous/new-api'
              isExternal
              showAnchorIcon={false}
              size='sm'
              className={linkClass}
            >
              New API
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className={`flex w-full flex-col gap-6 py-6 ${innerPadX}`}>
        {isDemoSiteMode && (
          <>
            <div className='flex flex-col gap-8 md:flex-row md:gap-10'>
              <div className='shrink-0'>
                <img
                  src={logo}
                  alt={systemName}
                  className='h-10 w-10 rounded-md object-contain'
                />
              </div>
              <div className='grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4'>
                {sections.map((section) => (
                  <FooterLinkSection
                    key={section.title}
                    title={section.title}
                    links={section.links}
                  />
                ))}
              </div>
            </div>
            {/* Same hairline as the chrome above — keeps the meta row
                visually distinct from the link grid without introducing
                a second visual treatment. */}
            <div className='h-px w-full bg-border' />
          </>
        )}

        <FooterMeta
          systemName={systemName}
          currentYear={currentYear}
          t={t}
        />
      </div>
    </div>
  );
};

export default FooterBar;
