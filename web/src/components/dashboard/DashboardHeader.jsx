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
import {
  Activity,
  ArrowUpRight,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

const DashboardHeader = ({
  getGreeting,
  greetingVisible,
  showSearchModal,
  refresh,
  loading,
  t,
}) => {
  return (
    <div className='console-dashboard-hero'>
      <div className='console-dashboard-hero-copy'>
        <div className='console-dashboard-eyebrow'>
          <Activity size={14} />
          {t('实时控制台')}
        </div>
        <h2
          className='console-dashboard-greeting transition-opacity duration-1000 ease-in-out'
          style={{ opacity: greetingVisible ? 1 : 0 }}
        >
          {getGreeting}
        </h2>
        <p className='console-dashboard-subtitle'>
          {t('在这里查看额度、调用、模型与服务状态。')}
        </p>
        <div className='console-dashboard-signal-row'>
          <span>{t('账户')}</span>
          <span>{t('用量')}</span>
          <span>{t('模型')}</span>
          <span>{t('服务')}</span>
        </div>
      </div>
      <div className='console-dashboard-command-panel'>
        <div className='console-dashboard-command-top'>
          <div>
            <div className='console-dashboard-command-label'>
              {t('运行状态')}
            </div>
            <div className='console-dashboard-command-value'>
              <span className='console-dashboard-status-dot' />
              {t('在线')}
            </div>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className='console-dashboard-radar'>
          <div className='console-dashboard-radar-ring' />
          <div className='console-dashboard-radar-core' />
          <div className='console-dashboard-radar-sweep' />
        </div>
        <div className='console-dashboard-actions'>
          <Button
            type='tertiary'
            icon={<Search size={16} />}
            onClick={showSearchModal}
            className='console-dashboard-action console-dashboard-action-search'
          >
            {t('筛选')}
          </Button>
          <Button
            type='tertiary'
            icon={<RefreshCw size={16} />}
            onClick={refresh}
            loading={loading}
            className='console-dashboard-action console-dashboard-action-refresh'
          >
            {t('刷新')}
          </Button>
        </div>
        <div className='console-dashboard-command-link'>
          {t('查看实时调用窗口')}
          <ArrowUpRight size={14} />
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
