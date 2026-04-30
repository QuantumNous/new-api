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

// /console/token table — thin glue around the shared HeroTable wrapper.
//
// Selection: the hook stores `selectedKeys` as an array of full row
// objects (not just IDs) so the batch-copy / batch-delete handlers can
// reach into each row's metadata. HeroTable handles the array <-> Set
// adapter; we just hand it the row list.
//
// Disabled rows are dimmed with `opacity-60` (status !== 1), matching
// the visual treatment the previous CardTable used (background tint).

import React, { useMemo } from 'react';
import HeroTable from '../../common/ui/HeroTable';
import { getTokensColumns } from './TokensColumnDefs';

const TokensTable = (tokensData) => {
  const {
    tokens,
    loading,
    selectedKeys,
    setSelectedKeys,
    showKeys,
    resolvedTokenKeys,
    loadingTokenKeys,
    toggleTokenVisibility,
    copyTokenKey,
    copyTokenConnectionString,
    manageToken,
    onOpenLink,
    setEditingToken,
    setShowEdit,
    refresh,
    groupRatios,
    t,
  } = tokensData;

  const columns = useMemo(
    () =>
      getTokensColumns({
        t,
        showKeys,
        resolvedTokenKeys,
        loadingTokenKeys,
        toggleTokenVisibility,
        copyTokenKey,
        copyTokenConnectionString,
        manageToken,
        onOpenLink,
        setEditingToken,
        setShowEdit,
        refresh,
        groupRatios,
      }),
    [
      t,
      showKeys,
      resolvedTokenKeys,
      loadingTokenKeys,
      toggleTokenVisibility,
      copyTokenKey,
      copyTokenConnectionString,
      manageToken,
      onOpenLink,
      setEditingToken,
      setShowEdit,
      refresh,
      groupRatios,
    ],
  );

  return (
    <HeroTable
      ariaLabel={t('令牌列表')}
      columns={columns}
      dataSource={tokens || []}
      loading={loading}
      emptyDescription={t('搜索无结果')}
      rowClassName={(item) => (item.status !== 1 ? 'opacity-60' : '')}
      rowSelection={{
        selectionMode: 'multiple',
        selectedRows: selectedKeys || [],
        onSelectionChange: (rows) => setSelectedKeys?.(rows),
      }}
    />
  );
};

export default TokensTable;
