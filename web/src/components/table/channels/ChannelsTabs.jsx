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
import { CHANNEL_OPTIONS } from '../../../constants';
import { getChannelIcon } from '../../../helpers';

function CountChip({ active, count }) {
  return (
    <span
      className={`inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        active
          ? 'bg-red-500 text-white'
          : 'bg-surface-secondary text-muted'
      }`}
    >
      {count}
    </span>
  );
}

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
  t,
}) => {
  if (enableTagMode) return null;

  const handleTabChange = (key) => {
    setActiveTypeKey(key);
    setActivePage(1);
    loadChannels(1, pageSize, idSort, enableTagMode, key);
  };

  const tabs = [
    {
      key: 'all',
      label: t('全部'),
      icon: null,
      count: channelTypeCounts['all'] || 0,
    },
    ...CHANNEL_OPTIONS.filter((opt) =>
      availableTypeKeys.includes(String(opt.value)),
    ).map((option) => ({
      key: String(option.value),
      label: option.label,
      icon: getChannelIcon(option.value),
      count: channelTypeCounts[option.value] || 0,
    })),
  ];

  return (
    <div
      role='tablist'
      aria-label={t('渠道类型')}
      className='mb-3 flex flex-wrap items-center gap-2'
    >
      {tabs.map((tab) => {
        const active = activeTypeKey === tab.key;
        return (
          <button
            key={tab.key}
            role='tab'
            aria-selected={active}
            type='button'
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
              active
                ? 'border-transparent bg-foreground text-background shadow-sm'
                : 'border-[color:var(--app-border)] bg-[color:var(--app-background)] text-foreground hover:bg-surface-secondary'
            }`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.icon}
            <span className='whitespace-nowrap'>{tab.label}</span>
            <CountChip active={active} count={tab.count} />
          </button>
        );
      })}
    </div>
  );
};

export default ChannelsTabs;
