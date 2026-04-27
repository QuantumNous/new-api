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

import React from 'react';
import { Chip, Tooltip } from '@heroui/react';

// 通用渲染函数：限制项目数量显示，支持popover展开
export function renderLimitedItems({ items, renderItem, maxDisplay = 3 }) {
  if (!items || items.length === 0) return '-';
  const displayItems = items.slice(0, maxDisplay);
  const remainingItems = items.slice(maxDisplay);
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {displayItems.map((item, idx) => renderItem(item, idx))}
      {remainingItems.length > 0 && (
        <Tooltip
          content={
            <div className='flex max-w-xs flex-wrap gap-1 p-1'>
                {remainingItems.map((item, idx) => renderItem(item, idx))}
            </div>
          }
        >
          <Chip size='sm' variant='tertiary'>
            +{remainingItems.length}
          </Chip>
        </Tooltip>
      )}
    </div>
  );
}

// 渲染描述字段，长文本支持tooltip
export const renderDescription = (text, maxWidth = 200) => {
  const value = text || '-';
  return (
    <Tooltip content={value}>
      <span className='block truncate text-sm text-foreground' style={{ maxWidth }}>
        {value}
      </span>
    </Tooltip>
  );
};
