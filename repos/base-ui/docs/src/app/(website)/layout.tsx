// Keep CSS imports first to ensure CSS layer order is correct
import 'docs/src/css/index.css';
import './css/index.css';

import * as React from 'react';
import type { Metadata, Viewport } from 'next/types';
import { GoogleAnalytics } from 'docs/src/components/GoogleAnalytics';
import { Link } from 'docs/src/components/Link';
import { Logo } from 'docs/src/components/Logo';
import { SearchTrigger } from 'docs/src/components/SearchTrigger';

export default function Layout({ children }: React.PropsWithChildren) {
  return (
    // Use suppressHydrationWarning to avoid https://github.com/facebook/react/issues/24430
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/die-grotesk-a-regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/die-grotesk-b-regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body suppressHydrationWarning className="Body bui-p-6 bp2:bui-py-7 bp2:bui-px-9">
        <GoogleAnalytics>
          <div
            className="bui-bs-bb bui-d-g bui-gtc-8 bui-g-8 bp2:bui-g-9"
            style={{ maxWidth: '1480px', marginInline: 'auto' }}
          >
            <header className="bui-d-c">
              <div className="bui-gcs-1 bui-gce-4">
                <Logo aria-label="Base UI" />
              </div>
              <nav
                className="bui-d-f bui-fd-c bui-g-2 bui-gcs-5 bui-gce-8 bp2:bui-gcs-5 bp2:bui-gce-9 bp3:bui-gcs-5 bp3:bui-gce-7"
                aria-label="social links"
              >
                <Link className="Text sz-1" href="https://x.com/base_ui">
                  X
                </Link>
                <Link className="Text sz-1" href="https://github.com/mui/base-ui">
                  GitHub
                </Link>
                <Link className="Text sz-1" href="https://base-ui.com/r/discord">
                  Discord
                </Link>
              </nav>
              <div className="bui-d-n bp3:bui-d-f bui-fd-c bui-g-2 bui-ai-s bui-gcs-7 bui-gce-9">
                <SearchTrigger containedScroll enableKeyboardShortcut />
              </div>
            </header>
            <main id="main" className="bui-d-c">
              {children}
            </main>
            <div className="bui-gcs-1 bui-gce-9 bp3:bui-gcs-3">
              <div className="Separator" role="separator" aria-hidden="true"></div>
            </div>
            <footer className="bui-d-c">
              <div className="bui-gcs-1 bui-gce-9 bp2:bui-gce-3">
                <span className="Text sz-1">© Base UI</span>
              </div>
              <nav
                className="bui-d-f bui-fd-c bui-g-2 bui-gcs-1 bui-gce-9 bp2:bui-gcs-3 bp4:bui-gce-7"
                aria-label="social links"
              >
                <Link className="Text sz-1" href="https://x.com/base_ui">
                  X
                </Link>
                <Link className="Text sz-1" href="https://github.com/mui/base-ui">
                  GitHub
                </Link>
                <Link className="Text sz-1" href="https://base-ui.com/r/discord">
                  Discord
                </Link>
                <Link className="Text sz-1" href="https://www.npmjs.com/package/@base-ui/react">
                  npm
                </Link>
                <Link className="Text sz-1" href="https://bsky.app/profile/base-ui.com">
                  Bluesky
                </Link>
              </nav>
            </footer>
          </div>
        </GoogleAnalytics>
      </body>
    </html>
  );
}

const SITE_TITLE = 'Unstyled UI components for accessible design systems · Base UI';

export const metadata: Metadata = {
  title: {
    template: '%s · Base UI',
    default: SITE_TITLE,
  },
  twitter: {
    site: '@base_ui',
    card: 'summary_large_image',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: './',
    title: {
      template: '%s · Base UI',
      default: SITE_TITLE,
    },
    ttl: 604800,
  },
  metadataBase: process.env.BASE_URL,
  alternates: {
    canonical: './',
  },
  icons: {
    // Based on https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
    icon: [
      {
        rel: 'icon',
        url:
          process.env.NODE_ENV !== 'production' ? '/static/favicon-dev.ico' : '/static/favicon.ico',
        sizes: '32x32',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        url:
          process.env.NODE_ENV !== 'production' ? '/static/favicon-dev.svg' : '/static/favicon.svg',
      },
    ],
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/static/apple-touch-icon.png',
      },
    ],
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  width: 'device-width',
  themeColor: [
    // Desktop Safari page background
    {
      media: '(prefers-color-scheme: light) and (min-width: 1024px)',
      color: 'oklch(95% 0.25% 264)',
    },
    {
      media: '(prefers-color-scheme: dark) and (min-width: 1024px)',
      color: 'oklch(25% 1% 264)',
    },
    // Mobile Safari header background (match the page content)
    {
      media: '(prefers-color-scheme: light)',
      color: '#FFF',
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: 'hsl(0deg 0% 6%)',
    },
  ],
};
