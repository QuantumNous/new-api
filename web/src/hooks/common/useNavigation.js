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
      docs: true,
      about: true,
    };

    // 使用传入的配置或默认配置
    const modules = headerNavModules || defaultModules;

    // 固定位置值与设置UI的语义插槽对应:
    // 0=在最前面, 1=首页之后, 2=控制台之后, 3=模型广场之后, 4=文档之后, 5=关于之后
    // 内置项使用 .5 值，确保自定义项能准确插入到指定位置
    const allLinks = [
      {
        text: t('首页'),
        itemKey: 'home',
        to: '/',
        _position: 0.5,
      },
      {
        text: t('控制台'),
        itemKey: 'console',
        to: '/console',
        _position: 1.5,
      },
      {
        text: t('模型广场'),
        itemKey: 'pricing',
        to: '/pricing',
        _position: 2.5,
      },
      ...(docsLink
        ? [
            {
              text: t('文档'),
              itemKey: 'docs',
              isExternal: true,
              externalLink: docsLink,
              _position: 3.5,
            },
          ]
        : []),
      {
        text: t('关于'),
        itemKey: 'about',
        to: '/about',
        _position: 4.5,
      },
    ];

    // 根据配置过滤导航链接
    const builtInLinks = allLinks.filter((link) => {
      if (link.itemKey === 'docs') {
        return docsLink && modules.docs;
      }
      if (link.itemKey === 'pricing') {
        // 支持新的pricing配置格式
        return typeof modules.pricing === 'object'
          ? modules.pricing.enabled
          : modules.pricing;
      }
      return modules[link.itemKey] === true;
    });

    // 合并自定义导航项
    const customItems = Array.isArray(modules.customItems)
      ? modules.customItems
      : [];
    const customLinks = customItems.map((item) => ({
      text: item.label,
      itemKey: item.id,
      to: item.isExternal ? undefined : item.url,
      isExternal: item.isExternal,
      externalLink: item.isExternal ? item.url : undefined,
      openInNewTab: item.openInNewTab,
      _position: item.position ?? 99,
    }));

    return [...builtInLinks, ...customLinks].sort(
      (a, b) => a._position - b._position,
    );
  }, [t, docsLink, headerNavModules]);

  return {
    mainNavLinks,
  };
};
