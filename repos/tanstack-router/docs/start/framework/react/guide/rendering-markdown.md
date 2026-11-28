---
id: rendering-markdown
title: Rendering Markdown
---

This guide covers two methods for importing and rendering markdown content in your TanStack Start application:

1. **Static markdown** with `content-collections` for build-time loading (e.g., blog posts)
2. **Dynamic markdown** fetched at runtime from GitHub or any remote source

Both methods share a common rendering pipeline using the `unified` ecosystem.

## Setting Up the Markdown Processor

Both approaches use the same markdown-to-HTML processing pipeline. First, install the required dependencies:

```bash
npm install unified remark-parse remark-gfm remark-rehype rehype-raw rehype-slug rehype-autolink-headings rehype-stringify shiki html-react-parser gray-matter
```

Create a markdown processor utility:

```tsx
// src/utils/markdown.ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'

export type MarkdownHeading = {
  id: string
  text: string
  level: number
}

export type MarkdownResult = {
  markup: string
  headings: Array<MarkdownHeading>
}

export async function renderMarkdown(content: string): Promise<MarkdownResult> {
  const headings: Array<MarkdownHeading> = []

  const result = await unified()
    .use(remarkParse) // Parse markdown
    .use(remarkGfm) // Support GitHub Flavored Markdown
    .use(remarkRehype, { allowDangerousHtml: true }) // Convert to HTML AST
    .use(rehypeRaw) // Process raw HTML in markdown
    .use(rehypeSlug) // Add IDs to headings
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: { className: ['anchor'] },
    })
    .use(() => (tree) => {
      // Extract headings for table of contents
      const { visit } = require('unist-util-visit')
      const { toString } = require('hast-util-to-string')

      visit(tree, 'element', (node: any) => {
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
          headings.push({
            id: node.properties?.id || '',
            text: toString(node),
            level: parseInt(node.tagName.charAt(1), 10),
          })
        }
      })
    })
    .use(rehypeStringify) // Serialize to HTML string
    .process(content)

  return {
    markup: String(result),
    headings,
  }
}
```

## Creating a Markdown Component

Create a React component that renders the processed HTML with custom element handling:

```tsx
// src/components/Markdown.tsx
import parse, { type HTMLReactParserOptions, Element } from 'html-react-parser'
import { renderMarkdown, type MarkdownResult } from '~/utils/markdown'

type MarkdownProps = {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const [result, setResult] = useState<MarkdownResult | null>(null)

  useEffect(() => {
    renderMarkdown(content).then(setResult)
  }, [content])

  if (!result) {
    return <div className={className}>Loading...</div>
  }

  const options: HTMLReactParserOptions = {
    replace: (domNode) => {
      if (domNode instanceof Element) {
        // Customize rendering of specific elements
        if (domNode.name === 'a') {
          // Handle links
          const href = domNode.attribs.href
          if (href?.startsWith('/')) {
            // Internal link - use your router's Link component
            return (
              <Link to={href}>{domToReact(domNode.children, options)}</Link>
            )
          }
        }

        if (domNode.name === 'img') {
          // Add lazy loading to images
          return (
            <img
              {...domNode.attribs}
              loading="lazy"
              className="rounded-lg shadow-md"
            />
          )
        }
      }
    },
  }

  return <div className={className}>{parse(result.markup, options)}</div>
}
```

## Method 1: Static Markdown with content-collections

The `content-collections` package is ideal for static content like blog posts that are included in your repository. It processes markdown files at build time and provides type-safe access to the content.

### Installation

```bash
npm install @content-collections/core @content-collections/vite
```

### Configuration

Create a `content-collections.ts` file in your project root:

```tsx
// content-collections.ts
import { defineCollection, defineConfig } from '@content-collections/core'
import matter from 'gray-matter'

function extractFrontMatter(content: string) {
  const { data, content: body, excerpt } = matter(content, { excerpt: true })
  return { data, body, excerpt: excerpt || '' }
}

const posts = defineCollection({
  name: 'posts',
  directory: './src/blog', // Directory containing your .md files
  include: '*.md',
  schema: (z) => ({
    title: z.string(),
    published: z.string().date(),
    description: z.string().optional(),
    authors: z.string().array(),
  }),
  transform: ({ content, ...post }) => {
    const frontMatter = extractFrontMatter(content)

    // Extract header image (first image in the document)
    const headerImageMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    const headerImage = headerImageMatch ? headerImageMatch[2] : undefined

    return {
      ...post,
      slug: post._meta.path,
      excerpt: frontMatter.excerpt,
      description: frontMatter.data.description,
      headerImage,
      content: frontMatter.body,
    }
  },
})

export default defineConfig({
  collections: [posts],
})
```

### Vite Integration

Add the content-collections plugin to your Vite config:

```tsx
// app.config.ts
import { defineConfig } from '@tanstack/react-start/config'
import contentCollections from '@content-collections/vite'

export default defineConfig({
  vite: {
    plugins: [contentCollections()],
  },
})
```

### Creating Blog Posts

Create markdown files in your designated directory:

````markdown
## <!-- src/blog/hello-world.md -->

title: Hello World
published: 2024-01-15
authors:

- Jane Doe
  description: My first blog post

---

![Hero Image](/images/hero.jpg)

Welcome to my blog! This is my first post.

## Getting Started

Here's some content with **bold** and _italic_ text.

```javascript
console.log('Hello, world!')
```
````

### Using the Collection

Access your posts through the generated collection:

```tsx
// src/routes/blog.index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { allPosts } from 'content-collections'

export const Route = createFileRoute('/blog/')({
  component: BlogIndex,
})

function BlogIndex() {
  // Posts are sorted by published date
  const sortedPosts = allPosts.sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime(),
  )

  return (
    <div>
      <h1>Blog</h1>
      <ul>
        {sortedPosts.map((post) => (
          <li key={post.slug}>
            <Link to="/blog/$slug" params={{ slug: post.slug }}>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <span>{post.published}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Rendering a Single Post

```tsx
// src/routes/blog.$slug.tsx
import { createFileRoute, notFound } from '@tanstack/react-router'
import { allPosts } from 'content-collections'
import { Markdown } from '~/components/Markdown'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = allPosts.find((p) => p.slug === params.slug)
    if (!post) {
      throw notFound()
    }
    return post
  },
  component: BlogPost,
})

function BlogPost() {
  const post = Route.useLoaderData()

  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        <p>
          By {post.authors.join(', ')} on {post.published}
        </p>
      </header>
      <Markdown content={post.content} className="prose" />
    </article>
  )
}
```

## Method 2: Dynamic Markdown from Remote Sources

For content stored externally (like GitHub repositories), you can fetch and render markdown dynamically using server functions.

### Creating a Fetch Utility

```tsx
// src/utils/docs.server.ts
import { createServerFn } from '@tanstack/react-start'
import matter from 'gray-matter'

type FetchDocsParams = {
  repo: string // e.g., 'tanstack/router'
  branch: string // e.g., 'main'
  filePath: string // e.g., 'docs/guide/getting-started.md'
}

export const fetchDocs = createServerFn({ method: 'GET' })
  .validator((params: FetchDocsParams) => params)
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`

    const response = await fetch(url, {
      headers: {
        // Add GitHub token for private repos or higher rate limits
        // Authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const rawContent = await response.text()
    const { data: frontmatter, content } = matter(rawContent)

    return {
      frontmatter,
      content,
      filePath,
    }
  })
```

### Adding Cache Headers

For production, add appropriate cache headers:

```tsx
export const fetchDocs = createServerFn({ method: 'GET' })
  .validator((params: FetchDocsParams) => params)
  .handler(async ({ data: { repo, branch, filePath }, context }) => {
    // Set cache headers for CDN caching
    context.response.headers.set(
      'Cache-Control',
      'public, max-age=0, must-revalidate',
    )
    context.response.headers.set(
      'CDN-Cache-Control',
      'max-age=300, stale-while-revalidate=300',
    )

    // ... fetch logic
  })
```

### Using Dynamic Markdown in Routes

```tsx
// src/routes/docs.$path.tsx
import { createFileRoute } from '@tanstack/react-router'
import { fetchDocs } from '~/utils/docs.server'
import { Markdown } from '~/components/Markdown'

export const Route = createFileRoute('/docs/$path')({
  loader: async ({ params }) => {
    return fetchDocs({
      data: {
        repo: 'your-org/your-repo',
        branch: 'main',
        filePath: `docs/${params.path}.md`,
      },
    })
  },
  component: DocsPage,
})

function DocsPage() {
  const { frontmatter, content } = Route.useLoaderData()

  return (
    <article>
      <h1>{frontmatter.title}</h1>
      <Markdown content={content} className="prose" />
    </article>
  )
}
```

### Fetching Directory Contents

To build navigation from a GitHub directory:

```tsx
// src/utils/docs.server.ts
type GitHubContent = {
  name: string
  path: string
  type: 'file' | 'dir'
}

export const fetchRepoContents = createServerFn({ method: 'GET' })
  .validator((params: { repo: string; branch: string; path: string }) => params)
  .handler(async ({ data: { repo, branch, path } }) => {
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        // Authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch contents: ${response.status}`)
    }

    const contents: Array<GitHubContent> = await response.json()

    return contents
      .filter((item) => item.type === 'file' && item.name.endsWith('.md'))
      .map((item) => ({
        name: item.name.replace('.md', ''),
        path: item.path,
      }))
  })
```

## Adding Syntax Highlighting with Shiki

For code blocks with syntax highlighting, integrate Shiki into your markdown processor:

```tsx
// src/utils/markdown.ts
import { codeToHtml } from 'shiki'

// Process code blocks after parsing
export async function highlightCode(
  code: string,
  language: string,
): Promise<string> {
  return codeToHtml(code, {
    lang: language,
    themes: {
      light: 'github-light',
      dark: 'tokyo-night',
    },
  })
}
```

Then handle code blocks in your Markdown component:

```tsx
// In your Markdown component's replace function
if (domNode.name === 'pre') {
  const codeElement = domNode.children.find(
    (child) => child instanceof Element && child.name === 'code',
  )
  if (codeElement) {
    const className = codeElement.attribs.class || ''
    const language = className.replace('language-', '') || 'text'
    const code = getText(codeElement)

    return <CodeBlock code={code} language={language} />
  }
}
```

## Summary

| Approach            | Best For                                  | Pros                                           | Cons                                      |
| ------------------- | ----------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| content-collections | Blog posts, static docs bundled with app  | Type-safe, build-time processing, fast runtime | Requires rebuild for content updates      |
| Dynamic fetching    | External docs, frequently updated content | Always fresh, no rebuild needed                | Runtime overhead, requires error handling |

Choose the approach that best fits your content update frequency and deployment workflow. For hybrid scenarios, you can use both methods in the same application.
