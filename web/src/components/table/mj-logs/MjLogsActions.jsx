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
import { Skeleton } from '@heroui/react';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const MjLogsActions = ({
  loading,
  showBanner,
  isAdminUser,
  compactMode,
  setCompactMode,
  t,
}) => {
  const showSkeleton = useMinimumLoadingTime(loading);

  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      {showSkeleton ? (
        <Skeleton className='h-5 w-[300px] rounded-md' />
      ) : (
        <span className='text-sm font-medium text-foreground'>
          {isAdminUser && showBanner
            ? t(
                '当前未开启Midjourney回调，部分项目可能无法获得绘图结果，可在运营设置中开启。',
              )
            : t('Midjourney 任务记录')}
        </span>
      )}

      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default MjLogsActions;
