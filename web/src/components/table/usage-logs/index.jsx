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
import CardPro from '../../common/ui/CardPro';
import LogsTable from './UsageLogsTable';
import LogsActions from './UsageLogsActions';
import LogsFilters from './UsageLogsFilters';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import UserInfoModal from './modals/UserInfoModal';
import ChannelAffinityUsageCacheModal from './modals/ChannelAffinityUsageCacheModal';
import ParamOverrideModal from './modals/ParamOverrideModal';
import { useLogsData } from '../../../hooks/usage-logs/useUsageLogsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';
import {
  Activity,
  CircleAlert,
  FileSearch,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import { renderQuota } from '../../../helpers';

const LogsPage = () => {
  const logsData = useLogsData();
  const isMobile = useIsMobile();
  const visibleLogCount = logsData.logs?.length || 0;
  const logSummaryItems = [
    {
      icon: FileSearch,
      label: logsData.t('日志总数'),
      value: logsData.logCount,
    },
    {
      icon: Activity,
      label: logsData.t('当前视图'),
      value: visibleLogCount,
    },
    {
      icon: Gauge,
      label: logsData.t('消耗额度'),
      value: logsData.showStat ? renderQuota(logsData.stat?.quota || 0) : '-',
    },
    {
      icon: CircleAlert,
      label: logsData.t('日志角色'),
      value: logsData.isAdminUser
        ? logsData.t('管理员视图')
        : logsData.t('个人视图'),
    },
  ];

  return (
    <div className='na-log-console'>
      {/* Modals */}
      <ColumnSelectorModal {...logsData} />
      <UserInfoModal {...logsData} />
      <ChannelAffinityUsageCacheModal {...logsData} />
      <ParamOverrideModal {...logsData} />

      {/* Main Content */}
      <section className='na-log-console-hero'>
        <div>
          <p className='na-log-console-eyebrow'>{logsData.t('请求证据台')}</p>
          <h1 className='na-log-console-title'>{logsData.t('使用日志')}</h1>
          <p className='na-log-console-copy'>
            {logsData.t(
              '按时间、令牌、模型、分组和 Request ID 追踪调用证据、计费过程与错误上下文。',
            )}
          </p>
        </div>
        <div className='na-log-console-risk'>
          <ShieldCheck size={16} />
          <span>{logsData.t('审计证据可追踪')}</span>
        </div>
      </section>

      <section className='na-log-summary-strip'>
        {logSummaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className='na-log-summary-item' key={item.label}>
              <Icon className='na-log-summary-icon' aria-hidden />
              <div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className='na-log-table-workbench'>
        <CardPro
          type='type2'
          statsArea={<LogsActions {...logsData} />}
          searchArea={<LogsFilters {...logsData} />}
          paginationArea={createCardProPagination({
            currentPage: logsData.activePage,
            pageSize: logsData.pageSize,
            total: logsData.logCount,
            onPageChange: logsData.handlePageChange,
            onPageSizeChange: logsData.handlePageSizeChange,
            isMobile: isMobile,
            t: logsData.t,
          })}
          t={logsData.t}
        >
          <LogsTable {...logsData} />
        </CardPro>
      </section>
    </div>
  );
};

export default LogsPage;
