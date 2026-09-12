import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: {
    template: '%s | Harness Examples',
    default: 'Harness Examples',
  },
  description:
    'Examples using the AI SDK harness abstraction with concrete harnesses.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
