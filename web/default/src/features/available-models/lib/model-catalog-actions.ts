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
 * Search params handing a model to the overview's integration examples, so the
 * model picker there lands pre-selected on the model the user came from.
 */
export function getModelQuickstartSearch(modelId: string): { model?: string } {
  const model = modelId.trim()
  return model ? { model } : {}
}

/** Full router target for the card's "Quick start" action. */
export function getModelQuickstartLink(modelId: string): {
  to: '/dashboard/$section'
  params: { section: 'overview' }
  search: { model?: string }
} {
  return {
    to: '/dashboard/$section',
    params: { section: 'overview' },
    search: getModelQuickstartSearch(modelId),
  }
}
