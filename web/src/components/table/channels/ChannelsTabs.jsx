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

// Channel-type filter strip — single-select pill bar that sits above the
// channels table and narrows the visible channels by upstream type.
//
// Renderer is HeroUI v3 `ToggleButtonGroup` + `ToggleButton` so each
// pill picks up the design-system focus ring, pressed transform,
// selected `--toggle-button-fg-selected` accent, and React Aria
// keyboard navigation (arrow keys to move, space/enter to activate).
// Previously this was a hand-rolled `<button role='tab'>` + custom
// border palette; that worked but didn't match the rest of the console.

import React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { CHANNEL_OPTIONS } from '../../../constants';
import { getChannelIcon } from '../../../helpers';

// Count badge that lives inside each pill. Selected pills paint the
// badge bg with the toggle's foreground accent (so it pops against
// `--toggle-button-bg-selected`); unselected pills get the muted
// surface chip.
function CountChip({ active, count }) {
  return (
    <span
      className={`inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        active
          ? 'bg-[color:var(--toggle-button-fg-selected)]/15 text-[color:var(--toggle-button-fg-selected)]'
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
    <ToggleButtonGroup
      isDetached
      size='sm'
      // React Aria's ToggleButtonGroup is multi-select by default; this
      // strip is a single-select filter so we accept both 'single' and
      // re-derive the picked key inside `onSelectionChange`.
      selectionMode='single'
      selectedKeys={[activeTypeKey]}
      // Re-affirm the current key when the user re-clicks the active
      // pill (default behaviour empties the set, which would leave the
      // strip with no visible "active" filter and silently revert the
      // backend query). Empty selection => keep current `activeTypeKey`.
      onSelectionChange={(keys) => {
        const next = Array.from(keys || [])[0];
        if (!next || next === activeTypeKey) return;
        handleTabChange(String(next));
      }}
      aria-label={t('渠道类型')}
      // The HeroUI base is `inline-flex w-fit justify-center`; channels
      // has 30+ types so we need to wrap to multiple rows AND align them
      // to the leading edge (otherwise the second row gets visually
      // centered, which reads as accidental). `mb-3` keeps the spacing
      // the previous flex container used.
      className='mb-3 !flex !w-full flex-wrap items-center !justify-start'
    >
      {tabs.map((tab) => {
        const active = activeTypeKey === tab.key;
        return (
          <ToggleButton key={tab.key} id={tab.key}>
            {tab.icon}
            <span className='whitespace-nowrap'>{tab.label}</span>
            <CountChip active={active} count={tab.count} />
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
};

export default ChannelsTabs;
