'use client';

import * as React from 'react';
import type { ContentProps } from '@mui/internal-docs-infra/CodeHighlighter/types';
import { useCode } from '@mui/internal-docs-infra/useCode';
import * as CodeBlock from './CodeBlock';

type CodeBlockPreComputedUserProps = {
  title?: string;
};

export function CodeBlockPreComputedContent(props: ContentProps<CodeBlockPreComputedUserProps>) {
  const code = useCode(props, {
    preClassName: 'CodeBlockPreInline CodeBlockPre',
  });
  const title = code.userProps.title;

  return (
    <React.Fragment>
      {title ? <CodeBlock.Panel>{title}</CodeBlock.Panel> : null}
      <CodeBlock.Content>{code.selectedFile}</CodeBlock.Content>
    </React.Fragment>
  );
}
