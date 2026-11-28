import {
  Geist_Mono as createMono,
  Geist as createSans,
} from 'next/font/google';

export const sans = createSans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: 'variable',
  display: 'swap',
});

export const mono = createMono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: 'variable',
  display: 'swap',
});
