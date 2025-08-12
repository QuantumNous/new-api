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
import { Space, Tag, Typography, Popover } from '@douyinfe/semi-ui';

const { Text } = Typography;

// 通用渲染函数：限制项目数量显示，支持popover展开
export function renderLimitedItems({ items, renderItem, maxDisplay = 3 }) {
  if (!items || items.length === 0) return '-';
  const displayItems = items.slice(0, maxDisplay);
  const remainingItems = items.slice(maxDisplay);
  return (
    <Space spacing={1} wrap>
      {displayItems.map((item, idx) => renderItem(item, idx))}
      {remainingItems.length > 0 && (
        <Popover
          content={
            <div className='p-2'>
              <Space spacing={1} wrap>
                {remainingItems.map((item, idx) => renderItem(item, idx))}
              </Space>
            </div>
          }
          position='top'
        >
          <Tag size='small' shape='circle' color='grey'>
            +{remainingItems.length}
          </Tag>
        </Popover>
      )}
    </Space>
  );
}

// 渲染描述字段，长文本支持tooltip
export const renderDescription = (text, maxWidth = 200) => {
  return (
    <Text ellipsis={{ showTooltip: true }} style={{ maxWidth }}>
      {text || '-'}
    </Text>
  );
};