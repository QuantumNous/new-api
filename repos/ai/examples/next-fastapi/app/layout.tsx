import './globals.css';
import { LogoNext, LogoPython } from './icons';
import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI SDK and FastAPI Examples',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        <Link href="/">
          <div className="border-b p-4 flex flex-row gap-2">
            <LogoNext />
            <div className="text-sm text-zinc-500">+</div>
            <LogoPython />
          </div>
        </Link>
        {children}
      </body>
    </html>
  );
}
