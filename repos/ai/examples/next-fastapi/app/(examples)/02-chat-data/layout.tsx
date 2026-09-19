import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'useChat',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
