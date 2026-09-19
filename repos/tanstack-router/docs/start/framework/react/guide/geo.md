---
id: geo
title: Generative Engine Optimization (GEO)
redirect_from:
  - /framework/react/guide/llmo
---

> [!NOTE]
> Looking for traditional search engine optimization? See the [SEO guide](./seo).

## What is GEO?

**Generative Engine Optimization (GEO)** is the practice of structuring your content and data so that AI systems—like ChatGPT, Claude, Perplexity, and other LLM-powered tools—can accurately understand, cite, and recommend your content.

While traditional SEO focuses on ranking in search engine results pages, GEO focuses on being accurately represented in AI-generated responses. As more users get information through AI assistants rather than traditional search, this is becoming increasingly important.

## How GEO Differs from SEO

| Aspect             | SEO                         | GEO                                  |
| ------------------ | --------------------------- | ------------------------------------ |
| **Goal**           | Rank in search results      | Be cited/recommended by AI           |
| **Audience**       | Search engine crawlers      | LLM training & retrieval systems     |
| **Key signals**    | Links, keywords, page speed | Structured data, clarity, authority  |
| **Content format** | Optimized for snippets      | Optimized for extraction & synthesis |

The good news: many GEO best practices overlap with SEO. Clear structure, authoritative content, and good metadata help both.

## What TanStack Start Provides

TanStack Start's features that support GEO:

- **Server-Side Rendering** - Ensures AI crawlers see fully rendered content
- **Structured Data** - JSON-LD support for machine-readable content
- **Document Head Management** - Meta tags that AI systems can parse
- **Server Routes** - Create machine-readable endpoints (APIs, feeds)

## Structured Data for AI

Structured data using schema.org vocabulary helps AI systems understand your content's meaning and context. This is perhaps the most important GEO technique.

### Article Schema

```tsx
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData.post.title }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: loaderData.post.title,
          description: loaderData.post.excerpt,
          image: loaderData.post.coverImage,
          author: {
            '@type': 'Person',
            name: loaderData.post.author.name,
            url: loaderData.post.author.url,
          },
          publisher: {
            '@type': 'Organization',
            name: 'My Company',
            logo: {
              '@type': 'ImageObject',
              url: 'https://myapp.com/logo.png',
            },
          },
          datePublished: loaderData.post.publishedAt,
          dateModified: loaderData.post.updatedAt,
        }),
      },
    ],
  }),
  component: PostPage,
})
```

### Product Schema

For e-commerce, product schema helps AI assistants provide accurate product information:

```tsx
export const Route = createFileRoute('/products/$productId')({
  loader: async ({ params }) => {
    const product = await fetchProduct(params.productId)
    return { product }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData.product.name }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: loaderData.product.name,
          description: loaderData.product.description,
          image: loaderData.product.images,
          brand: {
            '@type': 'Brand',
            name: loaderData.product.brand,
          },
          offers: {
            '@type': 'Offer',
            price: loaderData.product.price,
            priceCurrency: 'USD',
            availability: loaderData.product.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          },
          aggregateRating: loaderData.product.rating
            ? {
                '@type': 'AggregateRating',
                ratingValue: loaderData.product.rating,
                reviewCount: loaderData.product.reviewCount,
              }
            : undefined,
        }),
      },
    ],
  }),
  component: ProductPage,
})
```

### Organization and Website Schema

Add organization schema to your root route for site-wide context:

```tsx
// src/routes/__root.tsx
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'My App',
          url: 'https://myapp.com',
          publisher: {
            '@type': 'Organization',
            name: 'My Company',
            url: 'https://myapp.com',
            logo: 'https://myapp.com/logo.png',
            sameAs: [
              'https://twitter.com/mycompany',
              'https://github.com/mycompany',
            ],
          },
        }),
      },
    ],
  }),
  component: RootComponent,
})
```

### FAQ Schema

FAQ schema is particularly effective for GEO—AI systems often extract Q&A pairs:

```tsx
export const Route = createFileRoute('/faq')({
  loader: async () => {
    const faqs = await fetchFAQs()
    return { faqs }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: 'Frequently Asked Questions' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: loaderData.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        }),
      },
    ],
  }),
  component: FAQPage,
})
```

## Machine-Readable Endpoints

Create API endpoints that AI systems and developers can consume directly:

```ts
// src/routes/api/products.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/products')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const category = url.searchParams.get('category')

        const products = await fetchProducts({ category })

        return Response.json({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: products.map((product, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Product',
              name: product.name,
              description: product.description,
              url: `https://myapp.com/products/${product.id}`,
            },
          })),
        })
      },
    },
  },
})
```

## Content Best Practices

Beyond technical implementation, content structure matters for GEO:

### Clear, Factual Statements

AI systems extract factual claims. Make your key information explicit:

```tsx
// Good: Clear, extractable facts
function ProductDetails({ product }) {
  return (
    <article>
      <h1>{product.name}</h1>
      <p>
        {product.name} is a {product.category} made by {product.brand}. It costs
        ${product.price} and is available in {product.colors.join(', ')}.
      </p>
    </article>
  )
}
```

### Hierarchical Structure

Use proper heading hierarchy—AI systems use this to understand content organization:

```tsx
function DocumentationPage() {
  return (
    <article>
      <h1>Getting Started with TanStack Start</h1>

      <section>
        <h2>Installation</h2>
        <p>Install TanStack Start using npm...</p>

        <h3>Prerequisites</h3>
        <p>You'll need Node.js 18 or later...</p>
      </section>

      <section>
        <h2>Configuration</h2>
        <p>Configure your app in your build tool config...</p>
      </section>
    </article>
  )
}
```

### Authoritative Attribution

Include author information and sources—AI systems consider authority signals:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.post.title },
      { name: 'author', content: loaderData.post.author.name },
      {
        property: 'article:author',
        content: loaderData.post.author.profileUrl,
      },
      {
        property: 'article:published_time',
        content: loaderData.post.publishedAt,
      },
    ],
  }),
  component: PostPage,
})
```

## llms.txt

Some sites are adopting a `llms.txt` file (similar to `robots.txt`) to provide guidance to AI systems:

```ts
// src/routes/llms[.]txt.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const content = `# My App

> My App is a platform for building modern web applications.

## Documentation
- Getting Started: https://myapp.com/docs/getting-started
- API Reference: https://myapp.com/docs/api

## Key Facts
- Built with TanStack Start
- Supports React and Solid
- Full TypeScript support

## Contact
- Website: https://myapp.com
- GitHub: https://github.com/mycompany/myapp
`

        return new Response(content, {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      },
    },
  },
})
```

## Monitoring AI Citations

Unlike traditional SEO with established analytics, GEO monitoring is still evolving. Consider:

- **Test with AI assistants** - Ask ChatGPT, Claude, and Perplexity about your product/content
- **Monitor brand mentions** - Track how AI systems describe your offerings
- **Validate structured data** - Use [Google's Rich Results Test](https://search.google.com/test/rich-results) and [Schema.org Validator](https://validator.schema.org/)
- **Check AI search engines** - Monitor presence in Perplexity, Bing Chat, and Google AI Overviews
