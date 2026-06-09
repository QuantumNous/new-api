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

export const BLOG_PAGE_SIZE = 18

export const BLOG_CATEGORIES = [
  {
    id: 6,
    slug: 'voice-of-customer',
    name: 'Voice of Customer',
    description:
      'Signals from customers, reviews, and support conversations that improve product decisions.',
  },
  {
    id: 7,
    slug: 'marketing',
    name: 'Marketing',
    description:
      'Growth strategy, positioning, and customer language for AI-first teams.',
  },
  {
    id: 8,
    slug: 'e-commerce',
    name: 'Ecommerce',
    description:
      'Marketplace operations, commerce automation, and buyer insight workflows.',
  },
  {
    id: 134,
    slug: 'economic-academy',
    name: 'Economic Academy',
    description:
      'Practical guides for turning operational data into business decisions.',
  },
] as const

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]

export function getBlogCategory(slug: string): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((category) => category.slug === slug)
}
