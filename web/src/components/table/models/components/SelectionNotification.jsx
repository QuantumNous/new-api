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
import { Button } from '@heroui/react';

/**
 * SelectionNotification — bottom-anchored selection toolbar.
 * Renders only when selection is non-empty; replaces the previous
 * Semi Notification API which was missing in the v3 migration.
 */
const SelectionNotification = ({
  selectedKeys = [],
  t,
  onDelete,
  onAddPrefill,
  onClear,
  onCopy,
}) => {
  const count = selectedKeys.length;
  if (count === 0) return null;

  return (
    <div
      role='region'
      aria-label={t('批量操作')}
      className='pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4'
    >
      <div className='pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:bg-slate-950/95'>
        <div className='flex flex-1 flex-col'>
          <div className='text-sm font-semibold text-foreground'>
            {t('批量操作')}
          </div>
          <div className='text-xs text-muted'>
            {t('已选择 {{count}} 个模型', { count })}
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button size='sm' variant='flat' onPress={onClear}>
            {t('取消全选')}
          </Button>
          <Button size='sm' color='primary' onPress={onAddPrefill}>
            {t('加入预填组')}
          </Button>
          <Button size='sm' variant='bordered' onPress={onCopy}>
            {t('复制名称')}
          </Button>
          <Button size='sm' color='danger' onPress={onDelete}>
            {t('删除所选')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SelectionNotification;
