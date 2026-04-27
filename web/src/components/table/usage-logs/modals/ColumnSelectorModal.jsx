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
import { getLogsColumns } from '../UsageLogsColumnDefs';
import ColumnSelectorDialog from '../../../common/ui/ColumnSelectorDialog';

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
  }).filter(
    (column) =>
      isAdminUser ||
      (column.key !== COLUMN_KEYS.CHANNEL &&
        column.key !== COLUMN_KEYS.USERNAME &&
        column.key !== COLUMN_KEYS.RETRY),
  );

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
    >
      <div className='rounded-2xl border border-border bg-surface-secondary/60 p-3'>
        <div className='mb-2 text-sm font-semibold text-foreground'>
          {t('计费显示模式')}
        </div>
        <div className='flex flex-wrap gap-2'>
          {[
            {
              value: 'price',
              label: isTokensDisplay ? t('价格模式') : t('价格模式（默认）'),
            },
            {
              value: 'ratio',
              label: isTokensDisplay ? t('倍率模式（默认）') : t('倍率模式'),
            },
          ].map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() => setBillingDisplayMode(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                billingDisplayMode === option.value
                  ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-500/10 dark:text-sky-200'
                  : 'border-border bg-background text-muted hover:border-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </ColumnSelectorDialog>
  );
};

export default ColumnSelectorModal;
