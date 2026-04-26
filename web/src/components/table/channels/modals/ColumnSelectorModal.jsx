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
import { getChannelsColumns } from '../ChannelsColumnDefs';
import ColumnSelectorDialog from '../../../common/ui/ColumnSelectorDialog';

const ColumnSelectorModal = ({
  showColumnSelector,
  setShowColumnSelector,
  visibleColumns,
  handleColumnVisibilityChange,
  handleSelectAll,
  initDefaultColumns,
  COLUMN_KEYS,
  t,
  // Props needed for getChannelsColumns
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
}) => {
  // Get all columns for display in selector
  const allColumns = getChannelsColumns({
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
  }).filter((column) => column.title);

  return (
    <ColumnSelectorDialog
      title={t('列设置')}
      visible={showColumnSelector}
      onClose={() => setShowColumnSelector(false)}
      resetText={t('重置')}
      cancelText={t('取消')}
      confirmText={t('确定')}
      allText={t('全选')}
      visibleColumns={visibleColumns}
      columns={allColumns}
      onColumnChange={handleColumnVisibilityChange}
      onSelectAll={handleSelectAll}
      onReset={initDefaultColumns}
    />
  );
};

export default ColumnSelectorModal;
