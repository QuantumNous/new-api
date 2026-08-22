export type SeoInput = {
  title?: string
  /** When title is a short brand name, append this long-tail suffix: "Name - suffix" */
  titleSuffix?: string
  /** Full document title override (wins over title + titleSuffix) */
  fullTitle?: string
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
  seo_title?: string
  seo_title_suffix?: string
  seo_description?: string
  seo_keywords?: string
  seo_site_url?: string
  seo_og_image?: string
  seo_robots_index?: boolean
}
