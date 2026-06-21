/*
Copyright (C) 2026 DeepRouter

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
*/
import { Link } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

const PUBLIC_BASE = '/docs/integrations'

/**
 * Rewrites a relative href found inside an integration markdown file to an app
 * route or asset URL.
 *
 * - `./claude-code.md` / `claude-code.md`  -> `/resources/claude-code`
 * - `./README.md`                          -> `/resources`
 * - `./images/foo.png`                     -> `/docs/integrations/images/foo.png`
 * - `#section`                             -> kept as-is (in-page anchor)
 * - absolute `https://…` / `mailto:`       -> kept as-is (external)
 *
 * Note: the markdown ASSET path (`PUBLIC_BASE`) stays `/docs/integrations` —
 * those are static files in `public/`. Only the app route changed to `/resources`.
 */
function resolveDocHref(href: string): { to: string; external: boolean } {
  if (!href) return { to: '#', external: false }
  if (/^(https?:|mailto:|tel:)/i.test(href)) return { to: href, external: true }
  if (href.startsWith('#')) return { to: href, external: false }

  const clean = href.replace(/^\.\//, '')
  const mdMatch = clean.match(/^([\w-]+)\.md$/i)
  if (mdMatch) {
    const slug = mdMatch[1]
    if (slug.toLowerCase() === 'readme')
      return { to: '/resources', external: false }
    return { to: `/resources/${slug}`, external: false }
  }
  if (clean.startsWith('images/')) {
    return { to: `${PUBLIC_BASE}/${clean}`, external: true }
  }
  return { to: href, external: true }
}

interface DocMarkdownProps {
  children: string
  className?: string
}

export function DocMarkdown({ children, className }: DocMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm sm:prose-base dark:prose-invert max-w-none',
        'prose-headings:font-semibold prose-headings:tracking-tight prose-headings:scroll-mt-24',
        'prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-xl',
        'prose-p:leading-relaxed',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-card prose-pre:border prose-pre:rounded-xl',
        'prose-blockquote:border-l-primary prose-blockquote:bg-muted/40 prose-blockquote:py-1 prose-blockquote:font-normal prose-blockquote:not-italic',
        'prose-table:border prose-thead:bg-muted prose-table:block prose-table:overflow-x-auto',
        'prose-td:border prose-th:border prose-td:px-3 prose-th:py-1.5 prose-th:px-3 prose-th:py-2',
        'prose-img:rounded-lg prose-img:border prose-img:shadow-sm',
        '[overflow-wrap:anywhere] break-words',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ node: _node, href, children, ...props }) => {
            const { to, external } = resolveDocHref(href ?? '')
            if (external || to.startsWith('#')) {
              return (
                <a
                  href={to}
                  {...(external && to.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  {...props}
                >
                  {children}
                </a>
              )
            }
            return (
              <Link to={to} {...props}>
                {children}
              </Link>
            )
          },
          img: ({ node: _node, src, alt, ...props }) => {
            let resolved = typeof src === 'string' ? src : ''
            if (resolved && !/^(https?:|\/)/i.test(resolved)) {
              resolved = `${PUBLIC_BASE}/${resolved.replace(/^\.\//, '')}`
            }
            return <img src={resolved} alt={alt ?? ''} loading='lazy' {...props} />
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
