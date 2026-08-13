import { describe, expect, it } from 'bun:test'
import {
  filterWebsiteFeaturedCandidates,
  moveWebsiteFeaturedModel,
  type WebsiteFeaturedListItem,
} from './website-featured-utils'

const items: WebsiteFeaturedListItem[] = [
  { model_name: 'gpt-5.5', sort_order: 0, available: true },
  { model_name: 'claude-opus-4.7', sort_order: 1, available: true },
  { model_name: 'retired-model', sort_order: 2, available: false },
]

describe('website featured model helpers', () => {
  it('moves multiple featured models without mutating the source list', () => {
    expect(moveWebsiteFeaturedModel(items, 1, -1).map((item) => item.model_name)).toEqual([
      'claude-opus-4.7',
      'gpt-5.5',
      'retired-model',
    ])
    expect(items.map((item) => item.model_name)).toEqual([
      'gpt-5.5',
      'claude-opus-4.7',
      'retired-model',
    ])
  })

  it('filters candidates by model name and excludes selected models', () => {
    const candidates = [
      { model_name: 'gpt-5.5', available: true },
      { model_name: 'gpt-4o', available: true },
      { model_name: 'claude-opus-4.7', available: true },
    ]

    expect(filterWebsiteFeaturedCandidates(candidates, items, 'gpt')).toEqual([
      { model_name: 'gpt-4o', available: true },
    ])
  })
})
