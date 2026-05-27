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

export const useNavigation = (t, docsLink, headerNavModules) => {
  const mainNavLinks = useMemo(() => {
    // 默认配置，如果没有传入配置则显示所有模块
    const defaultModules = {
      home: true,
      console: true,
      pricing: true,
      rankings: true,
      docs: true,
      about: true,
    };

    // 使用传入的配置或默认配置
    const modules = {
      ...defaultModules,
      ...(headerNavModules || {}),
      pricing: headerNavModules?.pricing ?? defaultModules.pricing,
      rankings: headerNavModules?.rankings ?? defaultModules.rankings,
    };

    const allLinks = [
      // {
      //   text: t('首页'),
      //   itemKey: 'home',
      //   to: '/',
      // },
      {
        text: t('控制台'),
        itemKey: 'console',
        to: '/console',
      },
      {
        text: t('模型广场'),
        itemKey: 'pricing',
        to: '/pricing',
      },
      // {
      //   text: t('排行榜'),
      //   itemKey: 'rankings',
      //   to: '/rankings',
      // },
      ...(docsLink
        ? [
            {
              text: t('文档'),
              itemKey: 'docs',
              isExternal: true,
              externalLink: docsLink,
            },
          ]
        : []),
      {
        text: t('关于'),
        itemKey: 'about',
        to: '/about',
      },
    ];

    // 根据配置过滤导航链接
    return allLinks.filter((link) => {
      if (link.itemKey === 'docs') {
        return docsLink && modules.docs;
      }
      if (link.itemKey === 'pricing') {
        // 支持新的pricing配置格式
        return typeof modules.pricing === 'object'
          ? modules.pricing.enabled
          : modules.pricing;
      }
      if (link.itemKey === 'rankings') {
        return typeof modules.rankings === 'object'
          ? modules.rankings.enabled
          : modules.rankings;
      }
      return modules[link.itemKey] === true;
    });
  }, [t, docsLink, headerNavModules]);

  return {
    mainNavLinks,
  };
};
