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
import { PRODUCT_NAME } from '@/lib/product-brand'

// Kept apart from the spotlight component so the site-wide banner can name
// the event without pulling the landing page styles into every route.

export const FORGE_HACKATHON_URL = 'https://qupper.fastrun.com.cn/'
export const FORGE_SECTION_ID = 'hackathon'

export const FORGE_ASSETS = '/partners/qupper-forge'
export const FORGE_MARK = `${FORGE_ASSETS}/qupper-forge-mark.webp`

/** The event pairing names the API product, not just the brand. */
export const FORGE_PARTNER_NAME = `${PRODUCT_NAME}API`
