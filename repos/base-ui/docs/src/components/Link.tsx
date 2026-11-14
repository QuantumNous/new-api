import * as React from 'react';
import clsx from 'clsx';
import NextLink from 'next/link';
import './Link.css';

interface LinkProps extends React.ComponentProps<typeof NextLink> {
  withArrow?: boolean;
}

export function Link(props: LinkProps) {
  const { children, href, className, withArrow, ...rest } = props;
  let pathname = typeof href === 'string' ? href : href.pathname!;
  const content = withArrow ? (
    <React.Fragment>
      {children}
      <svg
        width="20"
        height="20"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="Icon"
      >
        <path className="LinkArrowCaret" d="M6 12L10 8L6 4"></path>
        <path className="LinkArrowLine" d="M2 8L13 8"></path>
      </svg>
    </React.Fragment>
  ) : (
    children
  );

  // Sometimes link come from component descriptions; in this case, remove the domain
  if (pathname.startsWith('https://base-ui.com/')) {
    pathname = pathname.replace('https://base-ui.com/', '/');
  }

  if (pathname.startsWith('#') || pathname.endsWith('.md') || pathname.endsWith('.txt')) {
    // Relative URL, but outside the Next.js router
    return (
      <a {...rest} href={pathname} className={clsx('Link', className)}>
        {content}
      </a>
    );
  }

  return (
    <NextLink {...rest} href={href} className={clsx('Link', className)}>
      {content}
    </NextLink>
  );
}
