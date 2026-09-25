import '../global.css';
import { GeistdocsProvider } from '@vercel/geistdocs/layout';
import { Navbar } from '@vercel/geistdocs/navbar';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/footer';
import { config } from '@/lib/geistdocs/config';
import { mono, sans } from '@/lib/geistdocs/fonts';

export const generateStaticParams = () => [{ lang: 'en' }];

export const metadata: Metadata = {
  metadataBase: new URL('https://ai-sdk.dev'),
  title: {
    default: 'AI SDK',
    template: '%s | AI SDK',
  },
  description:
    'The TypeScript toolkit for building AI applications and agents.',
  openGraph: {
    siteName: 'AI SDK',
    type: 'website',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { color: '#ffffff', media: '(prefers-color-scheme: light)' },
    { color: '#000000', media: '(prefers-color-scheme: dark)' },
  ],
};

const RootLayout = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) => {
  const { lang } = await params;

  return (
    <html
      className={`${sans.variable} ${mono.variable} antialiased`}
      lang={lang}
      suppressHydrationWarning
    >
      <head>
        <link href="/llms.txt" rel="llms-txt" />
      </head>
      <body>
        <GeistdocsProvider config={config} lang={lang}>
          <Navbar config={config} />
          {children}
          <Footer />
        </GeistdocsProvider>
      </body>
    </html>
  );
};

export default RootLayout;
