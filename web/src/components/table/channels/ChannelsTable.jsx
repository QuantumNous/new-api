/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// /console/channel table — thin glue around the shared HeroTable
// wrapper so the channels view inherits the same row rhythm and
// selection ergonomics as /console/token.
//
// Selection: only enabled when the parent toggles `enableBatchDelete`.
// `useChannelsData` tracks the picked rows in `selectedChannels` (an
// array of full row objects).
//
// Disabled rows (status !== 1) and parent "tag rows" (children !==
// undefined) inherit `opacity-60` so the visual disabled-state cue
// matches the tokens view.

import React, { useMemo } from 'react';
import HeroTable from '../../common/ui/HeroTable';
import { getChannelsColumns } from './ChannelsColumnDefs';

const ChannelsTable = (channelsData) => {
  const {
    channels,
    loading,
    searching,
    activePage,
    enableBatchDelete,
    compactMode,
    visibleColumns,
    selectedChannels,
    setSelectedChannels,
    t,
    COLUMN_KEYS,
    // Column functions and data
    updateChannelBalance,
    manageChannel,
    manageTag,
    submitTagEdit,
    testChannel,
    setCurrentTestChannel,
    setShowModelTestModal,
    setEditingChannel,
    setShowEdit,
    setShowEditTag,
    setEditingTag,
    copySelectedChannel,
    refresh,
    checkOllamaVersion,
    // Multi-key management
    setShowMultiKeyManageModal,
    setCurrentMultiKeyChannel,
    openUpstreamUpdateModal,
    detectChannelUpstreamUpdates,
  } = channelsData;

  const allColumns = useMemo(() => {
    return getChannelsColumns({
      t,
      COLUMN_KEYS,
      updateChannelBalance,
      manageChannel,
      manageTag,
      submitTagEdit,
      testChannel,
      setCurrentTestChannel,
      setShowModelTestModal,
      setEditingChannel,
      setShowEdit,
      setShowEditTag,
      setEditingTag,
      copySelectedChannel,
      refresh,
      activePage,
      channels,
      checkOllamaVersion,
      setShowMultiKeyManageModal,
      setCurrentMultiKeyChannel,
      openUpstreamUpdateModal,
      detectChannelUpstreamUpdates,
    });
  }, [
    t,
    COLUMN_KEYS,
    updateChannelBalance,
    manageChannel,
    manageTag,
    submitTagEdit,
    testChannel,
    setCurrentTestChannel,
    setShowModelTestModal,
    setEditingChannel,
    setShowEdit,
    setShowEditTag,
    setEditingTag,
    copySelectedChannel,
    refresh,
    activePage,
    channels,
    checkOllamaVersion,
    setShowMultiKeyManageModal,
    setCurrentMultiKeyChannel,
    openUpstreamUpdateModal,
    detectChannelUpstreamUpdates,
  ]);

  const visibleColumnsList = useMemo(
    () => allColumns.filter((column) => visibleColumns[column.key]),
    [visibleColumns, allColumns],
  );

  const tableColumns = useMemo(() => {
    return compactMode
      ? visibleColumnsList.map(({ fixed, ...rest }) => rest)
      : visibleColumnsList;
  }, [compactMode, visibleColumnsList]);

  return (
    <HeroTable
      ariaLabel={t('渠道列表')}
      columns={tableColumns}
      dataSource={channels || []}
      loading={loading || searching}
      emptyDescription={t('搜索无结果')}
      rowClassName={(record) =>
        record.status !== 1 ? 'opacity-60' : ''
      }
      rowSelection={
        enableBatchDelete
          ? {
              selectionMode: 'multiple',
              selectedRows: selectedChannels || [],
              onSelectionChange: (rows) => setSelectedChannels?.(rows),
            }
          : undefined
      }
    />
  );
};

export default ChannelsTable;
