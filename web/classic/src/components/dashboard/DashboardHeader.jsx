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
import { Button } from '@douyinfe/semi-ui';
import { RefreshCw, Search } from 'lucide-react';

const DashboardHeader = ({
  getGreeting,
  greetingVisible,
  showSearchModal,
  refresh,
  loading,
  timeOptions,
  dataExportDefaultTime,
  onGranularityChange,
  t,
}) => {
  const ICON_BUTTON_CLASS = 'text-white hover:bg-opacity-80 !rounded-full';
  const visibleTimeOptions = timeOptions || [];

  return (
    <div className='flex items-center justify-between mb-4'>
      <h2
        className='text-2xl font-semibold text-gray-800 transition-opacity duration-1000 ease-in-out'
        style={{ opacity: greetingVisible ? 1 : 0 }}
      >
        {getGreeting}
      </h2>
      <div className='flex flex-wrap items-center justify-end gap-2 sm:gap-3'>
        <div
          className='flex h-9 items-center overflow-hidden rounded-full border border-gray-200 bg-white p-1 shadow-sm'
          role='group'
          aria-label={t('时间粒度')}
        >
          {visibleTimeOptions.map((option) => {
            const selected = option.value === dataExportDefaultTime;
            return (
              <button
                key={option.value}
                type='button'
                aria-pressed={selected}
                disabled={loading}
                onClick={() => onGranularityChange?.(option.value)}
                className={`h-7 min-w-[3.5rem] rounded-full px-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${loading ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <Button
          type='tertiary'
          icon={<Search size={16} />}
          onClick={showSearchModal}
          className={`bg-green-500 hover:bg-green-600 ${ICON_BUTTON_CLASS}`}
        />
        <Button
          type='tertiary'
          icon={<RefreshCw size={16} />}
          onClick={refresh}
          loading={loading}
          className={`bg-blue-500 hover:bg-blue-600 ${ICON_BUTTON_CLASS}`}
        />
      </div>
    </div>
  );
};

export default DashboardHeader;
