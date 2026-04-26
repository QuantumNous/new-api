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
    <section className='na-dashboard-hero'>
      <div>
        <p className='na-dashboard-eyebrow'>{t('运营概览')}</p>
        <h1
          className='na-dashboard-hero-title'
          style={{ opacity: greetingVisible ? 1 : 0 }}
        >
          {getGreeting}
        </h1>
        <p className='na-dashboard-hero-copy'>
          {t('从余额、请求、消耗、性能和上游状态观察整套 AI 中转站。')}
        </p>
      </div>
      <div className='na-header-actions'>
        <Button
          type='tertiary'
          icon={<Search size={16} />}
          onClick={showSearchModal}
          className='na-icon-button'
          aria-label={t('筛选数据')}
        />
        <Button
          type='tertiary'
          icon={<RefreshCw size={16} />}
          onClick={refresh}
          loading={loading}
          className='na-icon-button'
          aria-label={t('刷新数据')}
        />
      </div>
    </section>
  );
};

export default DashboardHeader;
