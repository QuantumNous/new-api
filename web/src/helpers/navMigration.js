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

const BUILT_IN_ORDER = ['home', 'console', 'pricing', 'docs', 'about'];

export function migrateOldFormatToItems(modules) {
  const items = BUILT_IN_ORDER.map((key) => {
    if (key === 'pricing') {
      const val = modules[key];
      if (typeof val === 'object') {
        return {
          key,
          enabled: val.enabled !== false,
          requireAuth: val.requireAuth || false,
        };
      }
      return { key, enabled: val !== false, requireAuth: false };
    }
    return { key, enabled: modules[key] !== false };
  });

  const customItems = Array.isArray(modules.customItems)
    ? modules.customItems
    : [];
  const sorted = [...customItems].sort(
    (a, b) => (a.position ?? 99) - (b.position ?? 99),
  );

  const cursors = new Map();
  for (const ci of sorted) {
    const pos = ci.position ?? 99;
    const { position: _, ...rest } = ci;
    const customItem = { ...rest };

    if (pos === 0) {
      const cursor = cursors.get('start') ?? 0;
      items.splice(cursor, 0, customItem);
      cursors.set('start', cursor + 1);
    } else if (pos === 99) {
      items.push(customItem);
    } else {
      const anchorKey = BUILT_IN_ORDER[pos - 1];
      const anchorIdx = items.findIndex((it) => it.key === anchorKey);
      if (anchorIdx >= 0) {
        const cursor = cursors.get(anchorKey) ?? anchorIdx + 1;
        items.splice(cursor, 0, customItem);
        cursors.set(anchorKey, cursor + 1);
      } else {
        items.push(customItem);
      }
    }
  }

  return items;
}
