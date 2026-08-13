import type {
  WebsiteFeaturedCandidate,
  WebsiteFeaturedModel,
} from '../types'

export type WebsiteFeaturedListItem = WebsiteFeaturedModel

export function moveWebsiteFeaturedModel(
  items: WebsiteFeaturedListItem[],
  index: number,
  direction: -1 | 1
): WebsiteFeaturedListItem[] {
  const targetIndex = index + direction
  if (
    index < 0 ||
    index >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length
  ) {
    return [...items]
  }

  const next = [...items]
  ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
  return next.map((item, sortOrder) => ({ ...item, sort_order: sortOrder }))
}

export function filterWebsiteFeaturedCandidates(
  candidates: WebsiteFeaturedCandidate[],
  selected: WebsiteFeaturedListItem[],
  query: string
): WebsiteFeaturedCandidate[] {
  const selectedNames = new Set(selected.map((item) => item.model_name))
  const normalizedQuery = query.trim().toLowerCase()
  return candidates.filter((candidate) => {
    if (selectedNames.has(candidate.model_name)) return false
    if (!normalizedQuery) return true
    return candidate.model_name.toLowerCase().includes(normalizedQuery)
  })
}
