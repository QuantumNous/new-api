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
import { Modal, Button, Checkbox, RadioGroup, Radio } from '@douyinfe/semi-ui';
import { getLogsColumns } from '../UsageLogsColumnDefs';

const ColumnSelectorModal = ({
  showColumnSelector,
  setShowColumnSelector,
  visibleColumns,
  handleColumnVisibilityChange,
  handleSelectAll,
  initDefaultColumns,
  billingDisplayMode,
  setBillingDisplayMode,
  COLUMN_KEYS,
  isAdminUser,
  copyText,
  showUserInfoFunc,
  t,
}) => {
  const handleBillingDisplayModeChange = (eventOrValue) => {
    setBillingDisplayMode(eventOrValue?.target?.value ?? eventOrValue);
  };

  const isTokensDisplay =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('quota_display_type') === 'TOKENS';

  // Get all columns for display in selector
  const allColumns = getLogsColumns({
    t,
    COLUMN_KEYS,
    copyText,
    showUserInfoFunc,
    isAdminUser,
    billingDisplayMode,
  });

  return (
    <Modal
      title={t('列设置')}
      visible={showColumnSelector}
      onCancel={() => setShowColumnSelector(false)}
      footer={
        <div className='flex justify-end'>
          <Button onClick={() => initDefaultColumns()}>{t('重置')}</Button>
          <Button onClick={() => setShowColumnSelector(false)}>
            {t('取消')}
          </Button>
          <Button onClick={() => setShowColumnSelector(false)}>
            {t('确定')}
          </Button>
        </div>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            {t('计费显示模式')}
          </div>
          <RadioGroup
            type='button'
            value={billingDisplayMode}
            onChange={handleBillingDisplayModeChange}
          >
            <Radio value='price'>
              {isTokensDisplay ? t('价格模式') : t('价格模式（默认）')}
            </Radio>
            <Radio value='ratio'>
              {isTokensDisplay ? t('倍率模式（默认）') : t('倍率模式')}
            </Radio>
          </RadioGroup>
        </div>
        <Checkbox
          checked={Object.values(visibleColumns).every((v) => v === true)}
          indeterminate={
            Object.values(visibleColumns).some((v) => v === true) &&
            !Object.values(visibleColumns).every((v) => v === true)
          }
          onChange={(e) => handleSelectAll(e.target.checked)}
        >
          {t('全选')}
        </Checkbox>
      </div>
      <div
        className='flex flex-wrap max-h-96 overflow-y-auto rounded-lg p-4'
        style={{ border: '1px solid var(--semi-color-border)' }}
      >
        {allColumns.map((column) => {
          // Skip admin-only columns for non-admin users
          if (
            !isAdminUser &&
            (column.key === COLUMN_KEYS.CHANNEL ||
              column.key === COLUMN_KEYS.USERNAME ||
              column.key === COLUMN_KEYS.RETRY)
          ) {
            return null;
          }

          return (
            <div key={column.key} className='w-1/2 mb-4 pr-2'>
              <Checkbox
                checked={!!visibleColumns[column.key]}
                onChange={(e) =>
                  handleColumnVisibilityChange(column.key, e.target.checked)
                }
              >
                {column.title}
              </Checkbox>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default ColumnSelectorModal;
