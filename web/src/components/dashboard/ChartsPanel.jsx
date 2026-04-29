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
import { Card, Tabs, TabPane, Tag } from '@douyinfe/semi-ui';
import { PieChart } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';
import DashboardAnalysisTable from './DashboardAnalysisTable';

const ChartsPanel = ({
  activeChartTab,
  setActiveChartTab,
  spec_line,
  spec_model_line,
  spec_pie,
  spec_rank_bar,
  spec_user_rank,
  spec_user_trend,
  isAdminUser,
  analysisDimensionLabel,
  analysisMetricLabel,
  CARD_PROPS,
  CHART_CONFIG,
  FLEX_CENTER_GAP2,
  hasApiInfoPanel,
  t,
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className={`!rounded-2xl ${hasApiInfoPanel ? 'lg:col-span-3' : ''}`}
      title={
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-3'>
          <div className={FLEX_CENTER_GAP2}>
            <PieChart size={16} />
            {t('按{{dimension}}分析', { dimension: analysisDimensionLabel })}
          </div>
          <Tabs
            type='slash'
            activeKey={activeChartTab}
            onChange={setActiveChartTab}
          >
            <TabPane tab={<span>{t('消耗分布')}</span>} itemKey='1' />
            <TabPane tab={<span>{t('调用趋势')}</span>} itemKey='2' />
            <TabPane tab={<span>{t('调用次数分布')}</span>} itemKey='3' />
            <TabPane tab={<span>{t('调用次数排行')}</span>} itemKey='4' />
            {isAdminUser && (
              <TabPane tab={<span>{t('用户消耗排行')}</span>} itemKey='5' />
            )}
            {isAdminUser && (
              <TabPane tab={<span>{t('用户消耗趋势')}</span>} itemKey='6' />
            )}
          </Tabs>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='border-b border-[var(--semi-color-border)] px-4 py-3'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex flex-wrap items-center gap-2'>
            <Tag color='blue' shape='circle'>
              {t('当前分组维度')}: {analysisDimensionLabel}
            </Tag>
            <Tag color='green' shape='circle'>
              {t('当前统计口径')}: {analysisMetricLabel}
            </Tag>
          </div>
          <div className='text-xs text-[var(--semi-color-text-2)]'>
            {t('图表图例、横轴分组和下方表格都会按当前分组维度重新聚合')}
          </div>
        </div>
      </div>
      <div className='p-2'>
        <div className='h-96'>
          {activeChartTab === '1' && (
            <VChart spec={spec_line} option={CHART_CONFIG} />
          )}
          {activeChartTab === '2' && (
            <VChart spec={spec_model_line} option={CHART_CONFIG} />
          )}
          {activeChartTab === '3' && (
            <VChart spec={spec_pie} option={CHART_CONFIG} />
          )}
          {activeChartTab === '4' && (
            <VChart spec={spec_rank_bar} option={CHART_CONFIG} />
          )}
          {activeChartTab === '5' && isAdminUser && (
            <VChart spec={spec_user_rank} option={CHART_CONFIG} />
          )}
          {activeChartTab === '6' && isAdminUser && (
            <VChart spec={spec_user_trend} option={CHART_CONFIG} />
          )}
        </div>
      </div>
      <DashboardAnalysisTable
        activeChartTab={activeChartTab}
        spec_line={spec_line}
        spec_model_line={spec_model_line}
        spec_pie={spec_pie}
        spec_rank_bar={spec_rank_bar}
        spec_user_rank={spec_user_rank}
        spec_user_trend={spec_user_trend}
        isAdminUser={isAdminUser}
        analysisDimensionLabel={analysisDimensionLabel}
        t={t}
      />
    </Card>
  );
};

export default ChartsPanel;
