'use client';

import { useState } from 'react';

const COLLAPSED_LINE_COUNT = 6;

export default function CollapsibleOutput({
  content,
  className,
}: {
  content: string;
  className: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const lines = content.split('\n');
  const isCollapsible = lines.length > COLLAPSED_LINE_COUNT;
  const visibleContent =
    isCollapsible && !expanded
      ? lines.slice(0, COLLAPSED_LINE_COUNT).join('\n')
      : content;

  return (
    <div>
      <pre className={className}>{visibleContent}</pre>
      {isCollapsible && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          {expanded
            ? 'Show less'
            : `Show ${lines.length - COLLAPSED_LINE_COUNT} more line${
                lines.length - COLLAPSED_LINE_COUNT === 1 ? '' : 's'
              }`}
        </button>
      )}
    </div>
  );
}
