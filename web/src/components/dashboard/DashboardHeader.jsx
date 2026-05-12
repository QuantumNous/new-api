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
  t,
}) => {
  return (
    <section className='dashboard-header-panel mb-4'>
      <div className='dashboard-header-copy'>
        <div className='dashboard-header-eyebrow'>{t('工作台')}</div>
        <h2
          className='dashboard-header-title transition-opacity duration-1000 ease-in-out'
          style={{ opacity: greetingVisible ? 1 : 0 }}
        >
          {getGreeting}
        </h2>
        <p className='dashboard-header-subtitle'>
          {t('统一查看余额、用量、模型消耗和服务状态。')}
        </p>
      </div>
      <div className='dashboard-header-actions'>
        <Button
          type='tertiary'
          icon={<Search size={16} />}
          onClick={showSearchModal}
          className='dashboard-header-button'
        >
          {t('筛选')}
        </Button>
        <Button
          type='tertiary'
          icon={<RefreshCw size={16} />}
          onClick={refresh}
          loading={loading}
          className='dashboard-header-button dashboard-header-button-primary'
        >
          {t('刷新')}
        </Button>
      </div>
    </section>
  );
};

export default DashboardHeader;
