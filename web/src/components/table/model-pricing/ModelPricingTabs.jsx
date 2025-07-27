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
import { Tabs, TabPane, Tag } from '@douyinfe/semi-ui';

const ModelPricingTabs = ({
  activeKey,
  setActiveKey,
  modelCategories,
  categoryCounts,
  availableCategories,
  t
}) => {
  return (
    <Tabs
      activeKey={activeKey}
      type="card"
      collapsible
      onChange={key => setActiveKey(key)}
      className="mt-2"
    >
      {Object.entries(modelCategories)
        .filter(([key]) => availableCategories.includes(key))
        .map(([key, category]) => {
          const modelCount = categoryCounts[key] || 0;

          return (
            <TabPane
              tab={
                <span className="flex items-center gap-2">
                  {category.icon && <span className="w-4 h-4">{category.icon}</span>}
                  {category.label}
                  <Tag
                    color={activeKey === key ? 'red' : 'grey'}
                    shape='circle'
                  >
                    {modelCount}
                  </Tag>
                </span>
              }
              itemKey={key}
              key={key}
            />
          );
        })}
    </Tabs>
  );
};

export default ModelPricingTabs; 