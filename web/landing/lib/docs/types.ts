export interface DocFrontmatter {
  title: string;
  description?: string;
  order: number;
}

export interface DocSummary extends DocFrontmatter {
  href: string;
  slug: string[];
}

export interface DocDocument extends DocSummary {
  content: string;
  sectionDirectory: string;
}

export interface DocsNavigationSection {
  directory: string;
  title: string;
  documents: DocSummary[];
}

export interface DocTableOfContentsItem {
  depth: 2 | 3;
  title: string;
  id: string;
}
