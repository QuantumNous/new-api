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

// /console/models table — thin glue around the shared HeroTable wrapper
// so the models view inherits the same row rhythm, sticky-right
// operations column, hover bg, empty state and loading spinner as
// /console/token, /console/channel, /console/user, /console/redemption
// and /console/subscription.
//
// Previously this used the legacy `CardTable` wrapper which is built on
// a hand-rolled `<table>` and renders its empty state as a separate
// surface card outside the table. HeroTable (HeroUI Table + React Aria)
// renders the empty state inline via `renderEmptyState`, paints rows
// with the design-system surface tokens, and routes `fixed: 'right'`
// columns through the wrapper's sticky-right glue.

import React, { useMemo } from 'react';
import HeroTable from '../../common/ui/HeroTable';
import { getModelsColumns } from './ModelsColumnDefs';

const ModelsTable = (modelsData) => {
  const {
    models,
    loading,
    compactMode,
    rowSelection,
    setSelectedKeys,
    manageModel,
    setEditingModel,
    setShowEdit,
    refresh,
    vendorMap,
    t,
  } = modelsData;

  const columns = useMemo(() => {
    return getModelsColumns({
      t,
      manageModel,
      setEditingModel,
      setShowEdit,
      refresh,
      vendorMap,
    });
  }, [t, manageModel, setEditingModel, setShowEdit, refresh, vendorMap]);

  // Compact mode strips `fixed` from the operations column so it joins
  // the natural horizontal flow instead of being pinned right (matches
  // the same trick the other 4 admin tables use).
  const tableColumns = useMemo(() => {
    return compactMode
      ? columns.map((col) => {
          if (col.dataIndex === 'operate') {
            const { fixed, ...rest } = col;
            return rest;
          }
          return col;
        })
      : columns;
  }, [compactMode, columns]);

  // Adapt the legacy `useModelsData` rowSelection shape (Antd-style
  // `selectedRowKeys` / `onChange(keys, rows)`) into the
  // selection contract HeroTable expects (`selectionMode`,
  // `selectedRows`, `onSelectionChange(rows)`). Keep the original
  // hook contract untouched so the rest of the page (selection
  // notification, batch actions, prefill management) keeps working.
  const heroRowSelection = useMemo(
    () =>
      rowSelection
        ? {
            selectionMode: 'multiple',
            selectedRows: rowSelection.selectedRowKeys
              ? (models || []).filter((row) =>
                  rowSelection.selectedRowKeys.includes(row.id),
                )
              : [],
            onSelectionChange: (rows) => {
              setSelectedKeys?.(rows);
              rowSelection.onChange?.(
                rows.map((r) => r.id),
                rows,
              );
            },
          }
        : undefined,
    [rowSelection, models, setSelectedKeys],
  );

  return (
    <HeroTable
      ariaLabel={t('模型列表')}
      columns={tableColumns}
      dataSource={models || []}
      rowKey='id'
      loading={loading}
      emptyDescription={t('搜索无结果')}
      rowSelection={heroRowSelection}
      // Disabled models (status !== 1) are dimmed — same opacity
      // treatment Subscriptions / Channels use for soft-disabled rows.
      rowClassName={(record) => (record?.status !== 1 ? 'opacity-60' : '')}
    />
  );
};

export default ModelsTable;
