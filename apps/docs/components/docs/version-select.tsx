'use client';

import type { GeistdocsVersionConfig } from '@vercel/geistdocs/config';
import { GeistdocsRouteSelect } from '@vercel/geistdocs/versions';
import { usePathname } from 'next/navigation';

export const VersionSelect = ({
  current,
  missingPaths,
  versions,
}: {
  current: string;
  missingPaths: Record<string, string[]>;
  versions: GeistdocsVersionConfig[];
}) => {
  const pathname = usePathname();
  const currentVersion = versions.find(version => version.id === current);
  const currentPrefix = currentVersion?.routePrefix ?? '';
  const unversionedPath = pathname.startsWith(currentPrefix)
    ? pathname.slice(currentPrefix.length) || '/'
    : pathname;
  const items = versions.map(version => {
    const prefix = version.routePrefix ?? '';
    const targetPath = `${prefix}${unversionedPath}`;
    const fallbackPath = `${prefix}/docs/introduction`;

    return {
      ...version,
      href: missingPaths[version.id]?.includes(unversionedPath)
        ? fallbackPath
        : targetPath,
      routePrefix: undefined,
    };
  });

  return (
    <GeistdocsRouteSelect
      ariaLabel="Select documentation version"
      current={current}
      getDescription={({ item }) => item.description}
      items={items}
      renderIcon={({ active, item }) => (
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg border font-mono text-sm ${
            active
              ? 'border-blue-500 bg-blue-100 text-blue-900'
              : 'border-gray-alpha-400 bg-gray-100 text-gray-800'
          }`}
        >
          {item.id.replace(/^v/, '')}
        </span>
      )}
    />
  );
};
