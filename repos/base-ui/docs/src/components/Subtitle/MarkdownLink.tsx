'use client';
import { usePathname } from 'next/navigation';
import { MarkdownIcon } from '../../icons/MarkdownIcon';

export function MarkdownLink() {
  const pathname = usePathname();

  return (
    <a
      href={`${pathname}.md`}
      className="SubtitleLink"
      aria-label="View markdown source"
      rel="alternate"
      type="text/markdown"
    >
      <span className="SubtitleLinkText">
        <MarkdownIcon />
        View as Markdown
      </span>
    </a>
  );
}
