'use client';
import { usePathname } from 'next/navigation';
import { GitHubIcon } from '../../icons/GitHubIcon';

const SOURCE_CODE_REPO = process.env.SOURCE_CODE_REPO;
const SOURCE_CODE_REF = process.env.LIB_VERSION ? `v${process.env.LIB_VERSION}` : undefined;
const SOURCE_PATH_PREFIXES = ['/react/components/', '/react/utils/'] as const;

function getSourceUrl(pathname: string) {
  const sourcePathPrefix = SOURCE_PATH_PREFIXES.find((prefix) => pathname.startsWith(prefix));

  if (sourcePathPrefix == null) {
    return null;
  }

  const sourceSlug = pathname.slice(sourcePathPrefix.length).split('/').filter(Boolean);

  if (sourceSlug.length !== 1) {
    return null;
  }

  if (SOURCE_CODE_REPO == null || SOURCE_CODE_REF == null) {
    return null;
  }

  return `${SOURCE_CODE_REPO}/tree/${SOURCE_CODE_REF}/packages/react/src/${sourceSlug[0]}`;
}

export function ViewSourceLink() {
  const pathname = usePathname();
  const sourceUrl = getSourceUrl(pathname);

  if (sourceUrl == null) {
    return null;
  }

  return (
    <a
      href={sourceUrl}
      className="SubtitleLink"
      aria-label="View source on GitHub"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="SubtitleLinkText">
        <GitHubIcon />
        View source
      </span>
    </a>
  );
}
