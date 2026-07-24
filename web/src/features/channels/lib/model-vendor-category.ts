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

/**
 * Categorize model names by vendor based on common name patterns.
 */
export function categorizeModelsByVendor(
  models: string[]
): Record<string, string[]> {
  const categories: Record<string, string[]> = {}

  models.forEach((model) => {
    let category = 'Other'

    // Determine category based on model name
    if (
      model.toLowerCase().includes('gpt') ||
      model.toLowerCase().includes('o1') ||
      model.toLowerCase().includes('o3')
    ) {
      category = 'OpenAI'
    } else if (model.toLowerCase().includes('claude')) {
      category = 'Anthropic'
    } else if (model.toLowerCase().includes('gemini')) {
      category = 'Gemini'
    } else if (model.toLowerCase().includes('qwen')) {
      category = 'Qwen'
    } else if (model.toLowerCase().includes('deepseek')) {
      category = 'DeepSeek'
    } else if (model.toLowerCase().includes('glm')) {
      category = 'Zhipu'
    } else if (model.toLowerCase().includes('llama')) {
      category = 'Meta'
    } else if (model.toLowerCase().includes('mistral')) {
      category = 'Mistral'
    }

    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push(model)
  })

  return categories
}

/**
 * Sort vendor category entries alphabetically, with 'Other' last.
 */
export function getSortedVendorCategoryEntries(
  categories: Record<string, string[]>
): [string, string[]][] {
  return Object.entries(categories).sort(([a], [b]) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
}
