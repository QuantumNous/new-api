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

import { useMemo } from 'react';
import { migrateOldFormatToItems } from '../../helpers/navMigration';

const BUILT_IN_KEYS = ['home', 'console', 'pricing', 'docs', 'about'];

function resolveItems(headerNavModules) {
  if (!headerNavModules) return null;
  if (Array.isArray(headerNavModules.items)) {
    return headerNavModules.items;
  }
  return migrateOldFormatToItems(headerNavModules);
}

export const useNavigation = (t, docsLink, headerNavModules) => {
  const mainNavLinks = useMemo(() => {
    const items = resolveItems(headerNavModules);
    if (!items) {
      // fallback: show all built-in items
      const links = [
        { text: t('首页'), itemKey: 'home', to: '/' },
        { text: t('控制台'), itemKey: 'console', to: '/console' },
        { text: t('模型广场'), itemKey: 'pricing', to: '/pricing' },
      ];
      if (docsLink) {
        links.push({
          text: t('文档'),
          itemKey: 'docs',
          isExternal: true,
          externalLink: docsLink,
        });
      }
      links.push({ text: t('关于'), itemKey: 'about', to: '/about' });
      return links;
    }

    const builtInLinkMap = {
      home: { text: t('首页'), itemKey: 'home', to: '/' },
      console: { text: t('控制台'), itemKey: 'console', to: '/console' },
      pricing: { text: t('模型广场'), itemKey: 'pricing', to: '/pricing' },
      docs: docsLink
        ? {
            text: t('文档'),
            itemKey: 'docs',
            isExternal: true,
            externalLink: docsLink,
          }
        : null,
      about: { text: t('关于'), itemKey: 'about', to: '/about' },
    };

    const links = [];
    for (const item of items) {
      if (item.key && BUILT_IN_KEYS.includes(item.key)) {
        if (item.enabled === false) continue;
        if (item.key === 'docs' && !docsLink) continue;
        const link = builtInLinkMap[item.key];
        if (link) links.push(link);
      } else if (item.id) {
        links.push({
          text: item.label,
          itemKey: item.id,
          to: item.isExternal ? undefined : item.url,
          isExternal: item.isExternal,
          externalLink: item.isExternal ? item.url : undefined,
          openInNewTab: item.openInNewTab,
        });
      }
    }

    return links;
  }, [t, docsLink, headerNavModules]);

  return {
    mainNavLinks,
  };
};
