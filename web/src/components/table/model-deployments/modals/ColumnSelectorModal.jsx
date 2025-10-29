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
import { Modal, Button, Checkbox } from '@douyinfe/semi-ui';

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

  const allSelected = columnOptions.every(
    ({ key, required }) => required || visibleColumns[key],
  );
  const indeterminate =
    columnOptions.some(
      ({ key, required }) => !required && visibleColumns[key],
    ) && !allSelected;

  const handleConfirm = () => onCancel();

  return (
    <Modal
      title={t('列设置')}
      visible={visible}
      onCancel={onCancel}
      footer={
        <div className='flex justify-end gap-2'>
          <Button onClick={handleReset}>{t('重置')}</Button>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button type='primary' onClick={handleConfirm}>
            {t('确定')}
          </Button>
        </div>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <Checkbox
          checked={allSelected}
          indeterminate={indeterminate}
          onChange={(e) => handleSelectAll(e.target.checked)}
        >
          {t('全选')}
        </Checkbox>
      </div>
      <div
        className='flex flex-wrap max-h-96 overflow-y-auto rounded-lg p-4'
        style={{ border: '1px solid var(--semi-color-border)' }}
      >
        {columnOptions.map(({ key, label, required }) => (
          <div key={key} className='w-1/2 mb-4 pr-2'>
            <Checkbox
              checked={!!visibleColumns[key]}
              disabled={required}
              onChange={(e) =>
                handleColumnVisibilityChange(key, e.target.checked)
              }
            >
              {label}
            </Checkbox>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default ColumnSelectorModal;
