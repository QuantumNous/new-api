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
import { useEffect } from 'react'
import {
  buildPublicHrefLangLinks,
  getPublicPathLanguage,
  localizePublicPath,
} from '@/lib/public-locale'
import type { BlogPost } from '../types'

const SITE_NAME = 'Flatkey AI'
const DEFAULT_BLOG_DESCRIPTION =
  'Insights, product notes, and implementation guides for teams building on AI APIs.'
const ORGANIZATION_NAME = 'VOC AI'
const ORGANIZATION_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: '160 E Tasman Drive, Suite 202',
  addressLocality: 'San Jose',
  addressRegion: 'CA',
  postalCode: '95134',
  addressCountry: 'US',
}

const META_SELECTORS = [
  'meta[name="title"]',
  'meta[name="description"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:type"]',
  'meta[property="og:url"]',
  'meta[property="og:site_name"]',
  'meta[property="og:image"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
]

interface BlogSeoProps {
  title: string
  description?: string
  path: string
  type: 'blog' | 'category' | 'article'
  post?: BlogPost
  categoryName?: string
}

function buildAbsoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).href
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let element = document.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value)
  }
}

function upsertCanonical(href: string) {
  let element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }
  element.href = href
}

function upsertHrefLangLinks(origin: string, path: string) {
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
    .forEach((element) => element.remove())

  buildPublicHrefLangLinks(origin, path).forEach((alternate) => {
    const element = document.createElement('link')
    element.rel = 'alternate'
    element.hreflang = alternate.hrefLang
    element.href = alternate.href
    document.head.appendChild(element)
  })
}

function snapshotMeta() {
  return META_SELECTORS.map((selector) => {
    const element = document.querySelector<HTMLMetaElement>(selector)
    return {
      selector,
      element,
      attrs: element
        ? Array.from(element.attributes).map((attr) => ({
            name: attr.name,
            value: attr.value,
          }))
        : undefined,
    }
  })
}

function snapshotHrefLangLinks() {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      'link[rel="alternate"][hreflang]'
    )
  ).map((element) => ({
    attrs: Array.from(element.attributes).map((attr) => ({
      name: attr.name,
      value: attr.value,
    })),
  }))
}

function restoreMeta(
  snapshot: ReturnType<typeof snapshotMeta>,
  canonicalHref?: string
) {
  for (const item of snapshot) {
    const current = document.querySelector<HTMLMetaElement>(item.selector)
    if (!item.attrs) {
      current?.remove()
      continue
    }

    const element = current ?? item.element ?? document.createElement('meta')
    Array.from(element.attributes).forEach((attr) => {
      element.removeAttribute(attr.name)
    })
    item.attrs.forEach((attr) => {
      element.setAttribute(attr.name, attr.value)
    })
    if (!element.parentElement) document.head.appendChild(element)
  }

  if (canonicalHref) {
    upsertCanonical(canonicalHref)
  } else {
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.remove()
  }
}

function restoreHrefLangLinks(
  snapshot: ReturnType<typeof snapshotHrefLangLinks>
) {
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
    .forEach((element) => element.remove())

  snapshot.forEach((item) => {
    const element = document.createElement('link')
    item.attrs.forEach((attr) => {
      element.setAttribute(attr.name, attr.value)
    })
    document.head.appendChild(element)
  })
}

function buildPublisherSchema(canonicalUrl: string) {
  const origin = new URL(canonicalUrl).origin
  return {
    '@type': 'Organization',
    name: ORGANIZATION_NAME,
    url: origin,
    address: ORGANIZATION_ADDRESS,
    areaServed: 'Global',
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
  }
}

function buildBreadcrumbSchema(props: BlogSeoProps, canonicalUrl: string) {
  const origin = new URL(canonicalUrl).origin
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: SITE_NAME,
      item: origin,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Blog',
      item: `${origin}/blog`,
    },
  ]

  if (props.type === 'category' && props.categoryName) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: props.categoryName,
      item: canonicalUrl,
    })
  }

  if (props.type === 'article' && props.post) {
    if (props.post.categoryName && props.post.categorySlug) {
      items.push({
        '@type': 'ListItem',
        position: 3,
        name: props.post.categoryName,
        item: `${origin}/blog/category/${props.post.categorySlug}`,
      })
    }

    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: props.post.title,
      item: canonicalUrl,
    })
  }

  return {
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

function buildPageSchema(props: BlogSeoProps, canonicalUrl: string) {
  const publisher = buildPublisherSchema(canonicalUrl)

  if (props.type === 'article' && props.post) {
    return {
      '@type': 'BlogPosting',
      '@id': `${canonicalUrl}#article`,
      headline: props.post.title,
      description: props.post.summary || props.description,
      image: props.post.cover || undefined,
      datePublished: props.post.date || undefined,
      dateModified: props.post.date || undefined,
      articleSection: props.post.categoryName || undefined,
      author: {
        '@type': props.post.author ? 'Person' : 'Organization',
        name: props.post.author || ORGANIZATION_NAME,
      },
      publisher,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      about: [
        props.post.categoryName,
        'AI API gateway',
        'AI model operations',
      ].filter(Boolean),
    }
  }

  return {
    '@type': props.type === 'blog' ? 'Blog' : 'CollectionPage',
    '@id': `${canonicalUrl}#webpage`,
    name: props.title,
    description: props.description,
    url: canonicalUrl,
    publisher,
    about:
      props.type === 'category'
        ? [props.categoryName, 'AI API gateway', 'AI operations'].filter(
            Boolean
          )
        : ['AI API gateway', 'AI model operations', 'AI cost control'],
    audience: {
      '@type': 'Audience',
      audienceType: 'AI builders and operations teams',
    },
  }
}

function buildJsonLd(props: BlogSeoProps, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildPublisherSchema(canonicalUrl),
      buildPageSchema(props, canonicalUrl),
      buildBreadcrumbSchema(props, canonicalUrl),
    ],
  }
}

export function BlogSeo(props: BlogSeoProps) {
  const {
    categoryName,
    description: descriptionProp,
    path,
    post,
    title: titleProp,
    type,
  } = props

  useEffect(() => {
    if (typeof document === 'undefined') return

    const seoProps: BlogSeoProps = {
      title: titleProp,
      description: descriptionProp,
      path,
      type,
      post,
      categoryName,
    }
    const origin = window.location.origin
    const currentLanguage = getPublicPathLanguage(window.location.pathname)
    const localizedPath = localizePublicPath(path, currentLanguage)
    const canonicalUrl = buildAbsoluteUrl(localizedPath)
    const title = `${titleProp} | ${SITE_NAME}`
    const description = descriptionProp || DEFAULT_BLOG_DESCRIPTION
    const previousTitle = document.title
    const previousMeta = snapshotMeta()
    const previousHrefLangLinks = snapshotHrefLangLinks()
    const previousCanonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )?.href

    document.title = title
    upsertMeta('meta[name="title"]', { name: 'title', content: title })
    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: description,
    })
    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: title,
    })
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    })
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: type === 'article' ? 'article' : 'website',
    })
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: canonicalUrl,
    })
    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: SITE_NAME,
    })
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: post?.cover ? 'summary_large_image' : 'summary',
    })
    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: title,
    })
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    })

    if (post?.cover) {
      upsertMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: buildAbsoluteUrl(post.cover),
      })
      upsertMeta('meta[name="twitter:image"]', {
        name: 'twitter:image',
        content: buildAbsoluteUrl(post.cover),
      })
    }

    upsertCanonical(canonicalUrl)
    upsertHrefLangLinks(origin, path)

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.blogSeo = 'true'
    script.text = JSON.stringify(buildJsonLd(seoProps, canonicalUrl))
    document.head
      .querySelectorAll('script[data-blog-seo="true"]')
      .forEach((node) => node.remove())
    document.head.appendChild(script)

    return () => {
      document.title = previousTitle
      restoreMeta(previousMeta, previousCanonical)
      restoreHrefLangLinks(previousHrefLangLinks)
      document.head
        .querySelectorAll('script[data-blog-seo="true"]')
        .forEach((node) => node.remove())
    }
  }, [categoryName, descriptionProp, path, post, titleProp, type])

  return null
}
