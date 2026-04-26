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
import MjLogsTable from './MjLogsTable';
import MjLogsActions from './MjLogsActions';
import MjLogsFilters from './MjLogsFilters';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import ContentModal from './modals/ContentModal';
import { useMjLogsData } from '../../../hooks/mj-logs/useMjLogsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';
import {
  AlertTriangle,
  Brush,
  Columns3,
  FileSearch,
  Image,
} from 'lucide-react';

const MjLogsPage = () => {
  const mjLogsData = useMjLogsData();
  const isMobile = useIsMobile();
  const visibleMjCount = mjLogsData.logs?.length || 0;
  const visibleColumnCount = Object.values(
    mjLogsData.visibleColumns || {},
  ).filter(Boolean).length;
  const mjSummaryItems = [
    {
      icon: FileSearch,
      label: mjLogsData.t('任务总数'),
      value: mjLogsData.logCount,
    },
    {
      icon: Image,
      label: mjLogsData.t('当前视图'),
      value: visibleMjCount,
    },
    {
      icon: Columns3,
      label: mjLogsData.t('显示列'),
      value: visibleColumnCount,
    },
    {
      icon: AlertTriangle,
      label: mjLogsData.t('回调状态'),
      value:
        mjLogsData.isAdminUser && mjLogsData.showBanner
          ? mjLogsData.t('需检查')
          : mjLogsData.t('正常'),
    },
  ];

  return (
    <div className='na-mj-console'>
      {/* Modals */}
      <ColumnSelectorModal {...mjLogsData} />
      <ContentModal {...mjLogsData} />

      <section className='na-mj-console-hero'>
        <div>
          <p className='na-mj-console-eyebrow'>
            {mjLogsData.t('异步生成证据台')}
          </p>
          <h1 className='na-mj-console-title'>{mjLogsData.t('绘图日志')}</h1>
          <p className='na-mj-console-copy'>
            {mjLogsData.t(
              '追踪 Midjourney 绘图任务的提交结果、执行进度、图像产物和失败原因。',
            )}
          </p>
        </div>
        <div
          className={`na-mj-console-risk ${
            mjLogsData.isAdminUser && mjLogsData.showBanner
              ? 'na-mj-console-risk-warning'
              : ''
          }`}
        >
          <Brush size={16} />
          <span>
            {mjLogsData.isAdminUser && mjLogsData.showBanner
              ? mjLogsData.t('回调可能未开启')
              : mjLogsData.t('生成证据可回看')}
          </span>
        </div>
      </section>

      <section className='na-mj-summary-strip'>
        {mjSummaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className='na-mj-summary-item' key={item.label}>
              <Icon className='na-mj-summary-icon' aria-hidden />
              <div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className='na-mj-table-workbench'>
        <CardPro
          type='type2'
          statsArea={<MjLogsActions {...mjLogsData} />}
          searchArea={<MjLogsFilters {...mjLogsData} />}
          paginationArea={createCardProPagination({
            currentPage: mjLogsData.activePage,
            pageSize: mjLogsData.pageSize,
            total: mjLogsData.logCount,
            onPageChange: mjLogsData.handlePageChange,
            onPageSizeChange: mjLogsData.handlePageSizeChange,
            isMobile: isMobile,
            t: mjLogsData.t,
          })}
          t={mjLogsData.t}
        >
          <MjLogsTable {...mjLogsData} />
        </CardPro>
      </section>
    </div>
  );
};

export default MjLogsPage;
