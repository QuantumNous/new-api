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
import { Chip, Skeleton } from '@heroui/react';
import { renderQuota } from '../../../helpers';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';

const LogsActions = ({
  stat,
  loadingStat,
  showStat,
  compactMode,
  setCompactMode,
  t,
}) => {
  const showSkeleton = useMinimumLoadingTime(loadingStat);
  const needSkeleton = !showStat || showSkeleton;

  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      {needSkeleton ? (
        <div className='flex flex-wrap gap-2'>
          <Skeleton className='h-8 w-28 rounded-lg' />
          <Skeleton className='h-8 w-16 rounded-lg' />
          <Skeleton className='h-8 w-16 rounded-lg' />
        </div>
      ) : (
        <div className='flex flex-wrap gap-2'>
          <Chip color='primary' variant='flat' className='rounded-lg px-3 py-4 font-medium shadow-sm'>
            {t('消耗额度')}: {renderQuota(stat.quota)}
          </Chip>
          <Chip color='secondary' variant='flat' className='rounded-lg px-3 py-4 font-medium shadow-sm'>
            RPM: {stat.rpm}
          </Chip>
          <Chip variant='flat' className='rounded-lg px-3 py-4 font-medium shadow-sm'>
            TPM: {stat.tpm}
          </Chip>
        </div>
      )}

      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default LogsActions;
