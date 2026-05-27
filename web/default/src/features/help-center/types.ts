export type HelpArticle = {
  slug: string
  categoryKey: string
  title: string
  summary: string
  difficulty: '新手' | '基础' | '排障'
  readTime: string
  sourceBasis: string[]
  sections: string[]
  markdown: string
  audit: {
    writer: 'PASS'
    reviewer: 'PASS'
    notes: string[]
  }
}

export type HelpCategory = {
  key: string
  title: string
  description: string
  articleSlugs: string[]
}
