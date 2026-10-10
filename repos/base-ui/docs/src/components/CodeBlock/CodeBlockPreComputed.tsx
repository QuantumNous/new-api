import * as React from 'react';
import { CodeHighlighter } from '@mui/internal-docs-infra/CodeHighlighter';
import type { CodeHighlighterProps } from '@mui/internal-docs-infra/CodeHighlighter/types';
import { CodeBlockPreComputedContent } from './CodeBlockPreComputedContent';

type PreProps = {
  'data-name'?: string;
  'data-slug'?: string;
  'data-precompute'?: string;
  'data-content-props'?: string;
  'data-highlight-after'?: CodeHighlighterProps<object>['highlightAfter'];
  'data-enhance-after'?: CodeHighlighterProps<object>['enhanceAfter'];
};

export function CodeBlockPreComputed(props: PreProps) {
  if (!props['data-precompute']) {
    return (
      <div>
        Expected precompute data to be provided. Ensure that transformHtmlCodeBlock rehype plugin is
        used.
      </div>
    );
  }

  const precompute = JSON.parse(
    props['data-precompute'],
  ) as CodeHighlighterProps<object>['precompute'];

  const contentProps = props['data-content-props']
    ? JSON.parse(props['data-content-props'])
    : ({} as Record<string, unknown> | null);

  return (
    <CodeHighlighter
      name={props['data-name']}
      slug={props['data-slug']}
      precompute={precompute}
      highlightAfter={props['data-highlight-after'] ?? 'idle'}
      enhanceAfter={props['data-enhance-after'] ?? 'idle'}
      Content={CodeBlockPreComputedContent}
      contentProps={contentProps}
    />
  );
}
