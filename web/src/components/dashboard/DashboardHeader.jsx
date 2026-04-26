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
import { RefreshCw, Search } from 'lucide-react';

const DashboardHeader = ({
  getGreeting,
  greetingVisible,
  showSearchModal,
  refresh,
  loading,
  t,
}) => {
  return (
    <div className='flex items-center justify-between mb-4'>
      <h2
        className='text-xl font-semibold text-foreground truncate transition-opacity duration-1000 ease-in-out'
        style={{ opacity: greetingVisible ? 1 : 0 }}
      >
        {getGreeting}
      </h2>
      {/* Use the `ghost` variant so the trigger reads as a bare icon — the
          surrounding pill only fades in on hover/press, not at rest. */}
      <div className='flex gap-1'>
        <Button
          isIconOnly
          aria-label={t('搜索条件')}
          size='sm'
          variant='ghost'
          onPress={showSearchModal}
        >
          <Search size={16} />
        </Button>
        <Button
          isIconOnly
          aria-label={t('刷新')}
          isPending={loading}
          size='sm'
          variant='ghost'
          onPress={refresh}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;
