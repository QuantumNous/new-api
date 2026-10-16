import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { create } from 'xmlbuilder2'
import { createLogger } from './utils'
import type { TanStackStartOutputConfig } from './schema'
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces'

export type SitemapUrl = {
  loc: string
  lastmod: string
  priority?: number
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  alternateRefs?: Array<{
    href: string
    hreflang?: string
  }>
  images?: Array<{
    loc: string
    title?: string
    caption?: string
  }>
  news?: {
    publication: {
      name: string
      language: string
    }
    publicationDate: string | Date
    title: string
  }
}

export type SitemapData = {
  urls: Array<SitemapUrl>
}

function buildSitemapJson(
  pages: TanStackStartOutputConfig['pages'],
  host: string,
): SitemapData {
  const slash = checkSlash(host)

  const urls: Array<SitemapUrl> = pages
    .filter((page) => {
      return page.sitemap?.exclude !== true
    })
    .map((page) => ({
      loc: `${host}${slash}${page.path.replace(/^\/+/g, '')}`,
      lastmod: page.sitemap?.lastmod
        ? new Date(page.sitemap.lastmod).toISOString().split('T')[0]!
        : new Date().toISOString().split('T')[0]!,
      priority: page.sitemap?.priority,
      changefreq: page.sitemap?.changefreq,
      alternateRefs: page.sitemap?.alternateRefs,
      images: page.sitemap?.images,
      news: page.sitemap?.news,
    }))

  return { urls }
}

function jsonToXml(sitemapData: SitemapData): string {
  const sitemap = createXml('urlset')

  for (const item of sitemapData.urls) {
    const page = sitemap.ele('url')
    page.ele('loc').txt(item.loc)
    page.ele('lastmod').txt(item.lastmod)

    if (item.priority !== undefined) {
      page.ele('priority').txt(item.priority.toString())
    }
    if (item.changefreq) {
      page.ele('changefreq').txt(item.changefreq)
    }

    // Add alternate references
    if (item.alternateRefs?.length) {
      for (const ref of item.alternateRefs) {
        const alternateRef = page.ele('xhtml:link')
        alternateRef.att('rel', 'alternate')
        alternateRef.att('href', ref.href)
        if (ref.hreflang) {
          alternateRef.att('hreflang', ref.hreflang)
        }
      }
    }

    // Add images
    if (item.images?.length) {
      for (const image of item.images) {
        const imageElement = page.ele('image:image')
        imageElement.ele('image:loc').txt(image.loc)
        if (image.title) {
          imageElement.ele('image:title').txt(image.title)
        }
        if (image.caption) {
          imageElement.ele('image:caption').txt(image.caption)
        }
      }
    }

    // Add news
    if (item.news) {
      const newsElement = page.ele('news:news')
      const publication = newsElement.ele('news:publication')
      publication.ele('news:name').txt(item.news.publication.name)
      publication.ele('news:language').txt(item.news.publication.language)
      newsElement
        .ele('news:publication_date')
        .txt(new Date(item.news.publicationDate).toISOString().split('T')[0]!)
      newsElement.ele('news:title').txt(item.news.title)
    }
  }

  return sitemap.end({ prettyPrint: true })
}

export function buildSitemap({
  startConfig,
  publicDir,
}: {
  startConfig: TanStackStartOutputConfig
  publicDir: string
}) {
  const logger = createLogger('sitemap')

  let sitemapOptions = startConfig.sitemap

  if (!sitemapOptions && startConfig.pages.length) {
    sitemapOptions = { enabled: true, outputPath: 'sitemap.xml' }
  }

  if (!sitemapOptions?.enabled) {
    throw new Error('Sitemap is not enabled')
  }

  const { host, outputPath } = sitemapOptions

  if (!host) {
    if (!startConfig.sitemap) {
      logger.info(
        'Hint: Pages found, but no sitemap host has been set. To enable sitemap generation, set the `sitemap.host` option.',
      )
      return
    }
    throw new Error(
      'Sitemap host is not set and required to build the sitemap.',
    )
  }

  if (!outputPath) {
    throw new Error('Sitemap output path is not set')
  }

  const { pages } = startConfig

  if (!pages.length) {
    logger.info('No pages were found to build the sitemap. Skipping...')
    return
  }

  logger.info('Building Sitemap...')

  // Build the sitemap data
  const sitemapData = buildSitemapJson(pages, host)

  // Generate output paths
  const xmlOutputPath = path.join(publicDir, outputPath)
  const pagesOutputPath = path.join(publicDir, 'pages.json')

  try {
    // Write XML sitemap
    logger.info(`Writing sitemap XML at ${xmlOutputPath}`)
    writeFileSync(xmlOutputPath, jsonToXml(sitemapData))

    // Write pages data for runtime use
    logger.info(`Writing pages data at ${pagesOutputPath}`)
    writeFileSync(
      pagesOutputPath,
      JSON.stringify(
        {
          pages,
          host,
          lastBuilt: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
  } catch (e) {
    logger.error(`Unable to write sitemap files`, e)
  }
}

function createXml(elementName: 'urlset' | 'sitemapindex'): XMLBuilder {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele(elementName, {
      xmlns: 'https://www.sitemaps.org/schemas/sitemap/0.9',
      'xmlns:xhtml': 'http://www.w3.org/1999/xhtml',
    })
    .com(`This file was automatically generated by TanStack Start.`)
}

function checkSlash(host: string): string {
  const finalChar = host.slice(-1)
  return finalChar === '/' ? '' : '/'
}
