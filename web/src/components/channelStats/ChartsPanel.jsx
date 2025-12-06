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
import { Card, Tabs, TabPane, Empty } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { BarChart3 } from 'lucide-react';
import { CHART_TABS } from '../../constants/channelStats.constants';

const CHART_CONFIG = { mode: 'desktop-browser' };

const ChartsPanel = ({
  activeTab,
  setActiveTab,
  responseTimeChartSpec,
  successRateChartSpec,
  callCountChartSpec,
  usageTrendChartSpec,
  healthScoreChartSpec,
  errorAnalysisChartSpec,
  quotaTrendChartSpec,
  performanceData,
  usageData,
  healthData,
  errorData,
  t,
}) => {
  const hasPerformanceData = performanceData && performanceData.length > 0;
  const hasUsageData = usageData && usageData.length > 0;
  const hasHealthData = healthData && healthData.length > 0;
  const hasErrorData = errorData && errorData.length > 0;

  return (
    <Card
      bordered={false}
      bodyStyle={{ padding: 0 }}
      title={
        <div className='flex items-center gap-2'>
          <BarChart3 size={16} />
          {t('渠道统计图表')}
        </div>
      }
    >
      <Tabs
        type='line'
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ padding: '0 20px' }}
      >
        <TabPane tab={t('响应时间')} itemKey={CHART_TABS.PERFORMANCE}>
          <div className='h-96 p-4'>
            {hasPerformanceData ? (
              <VChart spec={responseTimeChartSpec} option={CHART_CONFIG} />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <Empty description={t('暂无数据')} />
              </div>
            )}
          </div>
        </TabPane>

        <TabPane tab={t('成功率')} itemKey='success_rate'>
          <div className='h-96 p-4'>
            {hasPerformanceData ? (
              <VChart spec={successRateChartSpec} option={CHART_CONFIG} />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <Empty description={t('暂无数据')} />
              </div>
            )}
          </div>
        </TabPane>

        <TabPane tab={t('调用分布')} itemKey={CHART_TABS.CALL_DISTRIBUTION}>
          <div className='h-96 p-4'>
            {hasPerformanceData ? (
              <VChart spec={callCountChartSpec} option={CHART_CONFIG} />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <Empty description={t('暂无数据')} />
              </div>
            )}
          </div>
        </TabPane>

        <TabPane tab={t('使用趋势')} itemKey={CHART_TABS.USAGE_TREND}>
          <div className='h-96 p-4'>
            {hasUsageData ? (
              <VChart spec={usageTrendChartSpec} option={CHART_CONFIG} />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <Empty description={t('暂无数据')} />
              </div>
            )}
          </div>
        </TabPane>

        <TabPane tab={t('费用趋势')} itemKey='quota_trend'>
          <div className='h-96 p-4'>
            {hasUsageData ? (
              <VChart spec={quotaTrendChartSpec} option={CHART_CONFIG} />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <Empty description={t('暂无数据')} />
              </div>
            )}
          </div>
        </TabPane>

        <TabPane tab={t('健康度')} itemKey={CHART_TABS.HEALTH_SCORE}>
          <div className='h-96 p-4'>
            {hasHealthData ? (
              <VChart spec={healthScoreChartSpec} option={CHART_CONFIG} />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <Empty description={t('暂无数据')} />
              </div>
            )}
          </div>
        </TabPane>

        <TabPane tab={t('错误分析')} itemKey={CHART_TABS.ERROR_ANALYSIS}>
          <div className='h-96 p-4'>
            {hasErrorData ? (
              <VChart spec={errorAnalysisChartSpec} option={CHART_CONFIG} />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <Empty description={t('暂无数据')} />
              </div>
            )}
          </div>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default ChartsPanel;

