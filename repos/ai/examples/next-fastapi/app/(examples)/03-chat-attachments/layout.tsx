import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'useChat with attachments',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
