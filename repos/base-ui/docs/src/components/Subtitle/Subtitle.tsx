import * as React from 'react';
import clsx from 'clsx';
import { MarkdownLink } from './MarkdownLink';
import { ViewSourceLink } from './ViewSourceLink';
import './Subtitle.css';

export function Subtitle({
  className,
  skipLinks = false,
  ...props
}: React.ComponentProps<'p'> & { skipLinks?: boolean }) {
  return (
    <div className={clsx('Subtitle', className)}>
      <p {...props} />
      {!skipLinks && (
        <div className="SubtitleLinks">
          <MarkdownLink />
          <ViewSourceLink />
        </div>
      )}
    </div>
  );
}
