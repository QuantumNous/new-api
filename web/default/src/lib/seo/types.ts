export type SeoInput = {
  title?: string
  description?: string
  keywords?: string
  siteUrl?: string
  path?: string
  ogImage?: string
  robotsIndex?: boolean
  lang?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null
}

export type StatusSeoFields = {
  system_name?: string
  logo?: string
  server_address?: string
  seo_description?: string
  seo_keywords?: string
  seo_site_url?: string
  seo_og_image?: string
  seo_robots_index?: boolean
}
