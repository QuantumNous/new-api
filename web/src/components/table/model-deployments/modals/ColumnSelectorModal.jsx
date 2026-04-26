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

import React, { useMemo } from 'react';
import ColumnSelectorDialog from '../../../common/ui/ColumnSelectorDialog';

const ColumnSelectorModal = ({
  visible,
  onCancel,
  visibleColumns,
  onVisibleColumnsChange,
  columnKeys,
  t,
}) => {
  const columnOptions = useMemo(
    () => [
      { key: columnKeys.container_name, label: t('容器名称'), required: true },
      { key: columnKeys.status, label: t('状态') },
      { key: columnKeys.time_remaining, label: t('剩余时间') },
      { key: columnKeys.hardware_info, label: t('硬件配置') },
      { key: columnKeys.created_at, label: t('创建时间') },
      { key: columnKeys.actions, label: t('操作'), required: true },
    ],
    [columnKeys, t],
  );

  const handleColumnVisibilityChange = (key, checked) => {
    const column = columnOptions.find((option) => option.key === key);
    if (column?.required) return;
    onVisibleColumnsChange({
      ...visibleColumns,
      [key]: checked,
    });
  };

  const handleSelectAll = (checked) => {
    const updated = { ...visibleColumns };
    columnOptions.forEach(({ key, required }) => {
      updated[key] = required ? true : checked;
    });
    onVisibleColumnsChange(updated);
  };

  const handleReset = () => {
    const defaults = columnOptions.reduce((acc, { key }) => {
      acc[key] = true;
      return acc;
    }, {});
    onVisibleColumnsChange({
      ...visibleColumns,
      ...defaults,
    });
  };

  return (
    <ColumnSelectorDialog
      title={t('列设置')}
      visible={visible}
      onClose={onCancel}
      resetText={t('重置')}
      cancelText={t('取消')}
      confirmText={t('确定')}
      allText={t('全选')}
      visibleColumns={visibleColumns}
      columns={columnOptions.map(({ key, label, required }) => ({
        key,
        title: label,
        disabled: required,
      }))}
      onColumnChange={handleColumnVisibilityChange}
      onSelectAll={handleSelectAll}
      onReset={handleReset}
    />
  );
};

export default ColumnSelectorModal;
