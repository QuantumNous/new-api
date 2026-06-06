/*
Copyright (C) 2025 QuantumNous

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

import i18n from '../i18n/i18n';

export const BRAND_NAME_EN = 'BabelTower';

const LEGACY_DEFAULT_NAMES = new Set([
  '',
  'New API',
  'NewAPI',
  'RedShore',
  BRAND_NAME_EN,
]);

export function getDisplayBrandName(systemName) {
  const normalized = (systemName || '').trim();
  if (!normalized || LEGACY_DEFAULT_NAMES.has(normalized)) {
    return i18n.t('brand.name');
  }
  return normalized;
}

export function applyBrandDocumentTitle(systemName) {
  if (typeof document === 'undefined') return;
  document.title = getDisplayBrandName(systemName);
}
