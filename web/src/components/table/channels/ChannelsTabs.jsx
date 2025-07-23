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
import { CHANNEL_OPTIONS } from '../../../constants/index.js';
import { getChannelIcon } from '../../../helpers/index.js';

const ChannelsTabs = ({
  enableTagMode,
  activeTypeKey,
  setActiveTypeKey,
  channelTypeCounts,
  availableTypeKeys,
  loadChannels,
  activePage,
  pageSize,
  idSort,
  setActivePage,
  t
}) => {
  if (enableTagMode) return null;

  const handleTabChange = (key) => {
    setActiveTypeKey(key);
    setActivePage(1);
    loadChannels(1, pageSize, idSort, enableTagMode, key);
  };

  return (
    <Tabs
      activeKey={activeTypeKey}
      type="card"
      collapsible
      onChange={handleTabChange}
      className="mb-2"
    >
      <TabPane
        itemKey="all"
        tab={
          <span className="flex items-center gap-2">
            {t('全部')}
            <Tag color={activeTypeKey === 'all' ? 'red' : 'grey'} shape='circle'>
              {channelTypeCounts['all'] || 0}
            </Tag>
          </span>
        }
      />

      {CHANNEL_OPTIONS.filter((opt) => availableTypeKeys.includes(String(opt.value))).map((option) => {
        const key = String(option.value);
        const count = channelTypeCounts[option.value] || 0;
        return (
          <TabPane
            key={key}
            itemKey={key}
            tab={
              <span className="flex items-center gap-2">
                {getChannelIcon(option.value)}
                {option.label}
                <Tag color={activeTypeKey === key ? 'red' : 'grey'} shape='circle'>
                  {count}
                </Tag>
              </span>
            }
          />
        );
      })}
    </Tabs>
  );
};

export default ChannelsTabs; 