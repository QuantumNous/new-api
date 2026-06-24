/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
'use client'

import {
  Children,
  type ComponentProps,
  type JSX,
  isValidElement,
  memo,
  type ReactNode,
  useState,
} from 'react'
import { Streamdown, type Components } from 'streamdown'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { cn } from '@/lib/utils'

type ResponseProps = ComponentProps<typeof Streamdown>

type CodeComponentProps = ComponentProps<'code'> & {
  node?: unknown
  'data-block'?: boolean
}

type MarkdownElementProps<T extends keyof JSX.IntrinsicElements> =
  ComponentProps<T> & {
    node?: unknown
  }

function getCodeText(children: ReactNode) {
  if (typeof children === 'string') {
    return children.replace(/\n$/, '')
  }

  if (Array.isArray(children)) {
    return children.join('').replace(/\n$/, '')
  }

  return String(children ?? '')
}

function getCodeLanguage(className?: string) {
  return className?.match(/language-([\w#+.-]+)/)?.[1] ?? 'plaintext'
}

function isSummaryElement(child: ReactNode) {
  return isValidElement(child) && child.type === 'summary'
}

function MarkdownImage({
  alt,
  className,
  node: _node,
  src,
  ...props
}: MarkdownElementProps<'img'>) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return (
      <span className='border-border/70 text-muted-foreground my-4 inline-flex rounded-md border px-3 py-2 text-xs italic'>
        {alt || 'Image not available'}
      </span>
    )
  }

  return (
    <img
      alt={alt}
      className={cn(
        'border-border/70 my-4 block h-auto max-h-96 max-w-full rounded-lg border object-contain',
        className
      )}
      loading='lazy'
      onError={() => setHasError(true)}
      src={src}
      {...props}
    />
  )
}

const responseComponents: Components = {
  h1({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'h1'>) {
    return (
      <h1
        className={cn(
          'mt-6 mb-3 text-xl font-semibold tracking-normal',
          className
        )}
        {...props}
      >
        {children}
      </h1>
    )
  },
  h2({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'h2'>) {
    return (
      <h2
        className={cn(
          'mt-6 mb-3 text-lg font-semibold tracking-normal',
          className
        )}
        {...props}
      >
        {children}
      </h2>
    )
  },
  h3({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'h3'>) {
    return (
      <h3
        className={cn(
          'mt-5 mb-2 text-base font-semibold tracking-normal',
          className
        )}
        {...props}
      >
        {children}
      </h3>
    )
  },
  h4({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'h4'>) {
    return (
      <h4
        className={cn('mt-5 mb-2 text-sm font-semibold', className)}
        {...props}
      >
        {children}
      </h4>
    )
  },
  h5({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'h5'>) {
    return (
      <h5
        className={cn(
          'text-muted-foreground mt-4 mb-2 text-sm font-semibold',
          className
        )}
        {...props}
      >
        {children}
      </h5>
    )
  },
  h6({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'h6'>) {
    return (
      <h6
        className={cn(
          'text-muted-foreground mt-4 mb-2 text-xs font-semibold uppercase',
          className
        )}
        {...props}
      >
        {children}
      </h6>
    )
  },
  ul({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'ul'>) {
    return (
      <ul
        className={cn(
          'my-3 list-outside list-disc space-y-1.5 pl-5',
          '[&.contains-task-list]:list-none [&.contains-task-list]:pl-0',
          className
        )}
        {...props}
      >
        {children}
      </ul>
    )
  },
  ol({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'ol'>) {
    return (
      <ol
        className={cn(
          'my-3 list-outside list-decimal space-y-1.5 pl-5',
          className
        )}
        {...props}
      >
        {children}
      </ol>
    )
  },
  li({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'li'>) {
    return (
      <li
        className={cn(
          'marker:text-muted-foreground pl-1 leading-7',
          '[&.task-list-item]:flex [&.task-list-item]:items-start [&.task-list-item]:gap-2 [&.task-list-item]:pl-0',
          '[&.task-list-item>input]:accent-primary [&.task-list-item>input]:mt-1.5 [&.task-list-item>input]:size-4',
          className
        )}
        {...props}
      >
        {children}
      </li>
    )
  },
  details({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'details'>) {
    const childArray = Children.toArray(children)
    const summaryChildren = childArray.filter(isSummaryElement)
    const contentChildren = childArray.filter(
      (child) => !isSummaryElement(child)
    )

    return (
      <details className={cn('my-4', className)} {...props}>
        {summaryChildren}
        {contentChildren.length > 0 && (
          <div className='border-border/70 ml-5 border-l pl-4'>
            {contentChildren}
          </div>
        )}
      </details>
    )
  },
  summary({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'summary'>) {
    return (
      <summary
        className={cn(
          'text-foreground marker:text-muted-foreground mb-2 cursor-pointer text-sm font-semibold',
          className
        )}
        {...props}
      >
        {children}
      </summary>
    )
  },
  blockquote({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'blockquote'>) {
    return (
      <blockquote
        className={cn(
          'border-border text-muted-foreground my-4 border-l-2 pl-4',
          className
        )}
        {...props}
      >
        {children}
      </blockquote>
    )
  },
  hr({ className, node: _node, ...props }: MarkdownElementProps<'hr'>) {
    return <hr className={cn('border-border/70 my-6', className)} {...props} />
  },
  img: MarkdownImage,
  table({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'table'>) {
    return (
      <div className='border-border/70 my-4 w-full overflow-x-auto rounded-lg border'>
        <table
          className={cn(
            'w-full min-w-max border-separate border-spacing-0 text-sm',
            className
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    )
  },
  thead({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'thead'>) {
    return (
      <thead className={cn('bg-muted/60', className)} {...props}>
        {children}
      </thead>
    )
  },
  tbody({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'tbody'>) {
    return (
      <tbody className={cn('divide-border/70 divide-y', className)} {...props}>
        {children}
      </tbody>
    )
  },
  tr({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'tr'>) {
    return (
      <tr className={cn('border-border/70', className)} {...props}>
        {children}
      </tr>
    )
  },
  th({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'th'>) {
    return (
      <th
        className={cn(
          'text-muted-foreground px-3 py-2 text-left text-xs font-semibold whitespace-nowrap',
          className
        )}
        {...props}
      >
        {children}
      </th>
    )
  },
  td({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<'td'>) {
    return (
      <td className={cn('px-3 py-2 align-top', className)} {...props}>
        {children}
      </td>
    )
  },
  code({ children, className, ...props }: CodeComponentProps) {
    if (!props['data-block']) {
      return (
        <code
          className={cn(
            'bg-muted/70 text-foreground rounded px-1 py-0.5 font-mono text-[0.9em]',
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }

    const code = getCodeText(children)
    const language = getCodeLanguage(className)
    const lineCount = code.split('\n').length

    return (
      <CodeBlock
        collapsedLines={14}
        code={code}
        defaultCollapsed={lineCount > 14}
        language={language}
        maxExpandedLines={44}
        showLineNumbers={true}
        showToolbar={true}
        title={language}
      >
        <CodeBlockCopyButton />
      </CodeBlock>
    )
  },
}

export const Response = memo(
  ({ className, children, components, ...props }: ResponseProps) => {
    const stripCustomTags = (input: unknown): unknown => {
      if (typeof input !== 'string') return input
      return (
        input
          // Remove known AI custom wrapper tags but keep inner content
          .replace(
            /<\/?(conversation|conversationcontent|reasoning|reasoningcontent|reasoningtrigger|sources|sourcescontent|sourcestrigger|branch|branchmessages|branchnext|branchpage|branchprevious|branchselector|message|messagecontent)\b[^>]*>/gi,
            ''
          )
          // Remove any stray <think> tags if they still appear
          .replace(/<\/?think\b[^>]*>/gi, '')
      )
    }

    const safeChildren = stripCustomTags(children) as string

    return (
      <Streamdown
        className={cn(
          'size-full min-w-0 text-pretty',
          '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          '[&_p]:my-3 [&_p]:leading-7',
          '[&_strong]:text-foreground [&_strong]:font-semibold',
          '[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline',
          '[&_details>summary~*]:border-border/70 [&_details]:my-4 [&_details>summary~*]:ml-5 [&_details>summary~*]:border-l [&_details>summary~*]:pl-4',
          '[&_summary]:text-foreground [&_summary::marker]:text-muted-foreground [&_summary]:mb-2 [&_summary]:cursor-pointer [&_summary]:text-sm [&_summary]:font-semibold',
          '[&_[data-streamdown=table-wrapper]]:border-0 [&_[data-streamdown=table-wrapper]]:bg-transparent [&_[data-streamdown=table-wrapper]]:p-0 [&_[data-streamdown=table-wrapper]]:shadow-none',
          '[&_[data-streamdown=table-wrapper]>div:first-child]:hidden',
          '[&_[data-streamdown=table-wrapper]>div:last-child]:border-border/70 [&_[data-streamdown=table-wrapper]>div:last-child]:rounded-lg',
          className
        )}
        components={{ ...responseComponents, ...components }}
        {...props}
      >
        {safeChildren}
      </Streamdown>
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = 'Response'
