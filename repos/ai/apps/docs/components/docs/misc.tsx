import Link from 'next/link';
import type { ReactNode } from 'react';

export const GithubLink = ({ link }: { link: string }) => (
  <Link
    className="not-prose group flex flex-row justify-between rounded-md border border-gray-alpha-400 p-3 text-gray-1000"
    href={link}
    rel="noopener noreferrer"
    target="_blank"
  >
    <span className="pr-8 leading-6 group-hover:underline">
      View Example on GitHub
    </span>
    <span aria-hidden>↗</span>
  </Link>
);

export const ButtonLink = ({
  href,
  children,
  resolveHref = value => value,
}: {
  href: string;
  children?: ReactNode;
  resolveHref?: (href: string) => string;
}) => (
  <Link
    className="not-prose inline-flex items-center rounded-md bg-gray-1000 px-4 py-2 font-medium text-background-100 text-sm hover:bg-gray-900"
    href={resolveHref(href)}
  >
    {children}
  </Link>
);
