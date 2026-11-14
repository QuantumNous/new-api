import * as React from 'react';
import clsx from 'clsx';
import * as CodeBlock from './components/CodeBlock';
import * as Table from './components/Table';
import * as QuickNav from './components/QuickNav/QuickNav';
import { Code } from './components/Code';
import { Link } from './components/Link';
import { HeadingLink } from './components/HeadingLink';
import { Subtitle } from './components/Subtitle/Subtitle';
import { TypeRef } from './components/TypeRef';
import { TypePropRef } from './components/TypePropRef';
import { Kbd } from './components/Kbd/Kbd';
import { CodeBlockPreComputed } from './components/CodeBlock/CodeBlockPreComputed';
import './css/mdx-components.css';

interface MDXComponents {
  [key: string]: React.FC<any> | MDXComponents;
}

// Maintain spacing between MDX components here
export const mdxComponents: MDXComponents = {
  a: Link,
  em: (props) => <em className="MdEm" {...props} />,
  code: (props) => <Code {...props} className={clsx('MdCode', props.className)} />,
  h1: (props) => (
    // Do not wrap heading tags in divs, that confuses Safari Reader
    <h1 className="MdH1" {...props} />
  ),
  h2: ({ children, id, ...otherProps }) => {
    return (
      <h2 className="MdH2" id={id} {...otherProps}>
        <HeadingLink id={id}>{children}</HeadingLink>
      </h2>
    );
  },
  h3: ({ children, id, ...otherProps }) => {
    return (
      <h3 className="MdH3" id={id} {...otherProps}>
        <HeadingLink id={id}>{children}</HeadingLink>
      </h3>
    );
  },
  h4: (props) => <h4 className="MdH4" {...props} />,
  h5: (props) => <h5 className="MdH5" {...props} />,
  h6: (props) => <h6 className="MdH6" {...props} />,
  p: (props) => <p className="MdP" {...props} />,
  li: (props) => <li className="MdListItem" {...props} />,
  ul: (props) => <ul className="MdUl" {...props} />,
  ol: (props) => <ol className="MdOl" {...props} />,
  kbd: Kbd,
  figure: (props) => <figure className="MdFigure" {...props} />,
  pre: ({ tabIndex, ...props }) => {
    if ('data-precompute' in props) {
      return (
        <CodeBlock.Root className="MdFigure">
          <CodeBlockPreComputed {...props} />
        </CodeBlock.Root>
      );
    }

    return <CodeBlock.Pre {...props} />;
  },
  table: (props) => <Table.Root className="MdTable" {...props} />,
  thead: Table.Head,
  tbody: Table.Body,
  tr: Table.Row,
  th: (props: React.ComponentProps<'th'>) =>
    props.scope === 'row' ? <Table.RowHeader {...props} /> : <Table.ColumnHeader {...props} />,
  td: Table.Cell,
  // Custom components
  TypeRef,
  TypePropRef,
  QuickNav,
  Meta: (props: React.ComponentProps<'meta'>) => {
    if (props.name === 'description' && String(props.content).length > 170) {
      throw new Error("Meta description shouldn't be longer than 170 chars");
    }
    // At build time, `transformMarkdownMetadata` extracts <Meta> attributes
    // and injects them as `export const metadata = { ... }` into the compiled
    // MDX. Next.js picks that export up and emits the <meta> tag itself, so
    // rendering one here would produce a duplicate.
    return null;
  },
  Subtitle: (props) => <Subtitle {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return mdxComponents;
}
