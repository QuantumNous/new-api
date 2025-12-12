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

import React, { useEffect } from 'react';
import {
  Layout,
  Button,
  Select,
  DatePicker,
  Card,
  Space,
  Switch,
  Spin,
} from '@douyinfe/semi-ui';
import { RefreshCw, Download, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';

import { useChannelStatsData } from '../../hooks/channelStats/useChannelStatsData';
import { useChannelStatsCharts } from '../../hooks/channelStats/useChannelStatsCharts';
import StatsCards from '../../components/channelStats/StatsCards';
import ChartsPanel from '../../components/channelStats/ChartsPanel';
import ComparisonTable from '../../components/channelStats/ComparisonTable';
import RealtimeMonitor from '../../components/channelStats/RealtimeMonitor';

import {
  TIME_RANGE_PRESETS,
  TIME_GRANULARITY_OPTIONS,
  AUTO_REFRESH_INTERVALS,
  EXPORT_FORMATS,
} from '../../constants/channelStats.constants';

const { Content } = Layout;

const ChannelStats = () => {
  const { t } = useTranslation();

  // Initialize VChart theme
  useEffect(() => {
    initVChartSemiTheme();
  }, []);

  // Data management
  const {
    performanceData,
    usageData,
    healthData,
    realtimeData,
    errorData,
    allChannels,
    loading,
    activeTab,
    setActiveTab,
    selectedChannelIds,
    setSelectedChannelIds,
    timeRange,
    setTimeRange,
    customTimeRange,
    setCustomTimeRange,
    timeGranularity,
    setTimeGranularity,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    autoRefreshInterval,
    setAutoRefreshInterval,
    refreshAllData,
    exportData,
  } = useChannelStatsData();

  // Chart specs
  const {
    responseTimeChartSpec,
    successRateChartSpec,
    callCountChartSpec,
    usageTrendChartSpec,
    healthScoreChartSpec,
    errorAnalysisChartSpec,
    quotaTrendChartSpec,
  } = useChannelStatsCharts(performanceData, usageData, healthData, errorData, t);

  // Time range options
  const timeRangeOptions = [
    { value: TIME_RANGE_PRESETS.TODAY, label: t('今天') },
    { value: TIME_RANGE_PRESETS.LAST_7_DAYS, label: t('最近7天') },
    { value: TIME_RANGE_PRESETS.LAST_30_DAYS, label: t('最近30天') },
    { value: TIME_RANGE_PRESETS.CUSTOM, label: t('自定义') },
  ];

  // Channel options
  const channelOptions = allChannels.map((channel) => ({
    value: channel.id,
    label: `${channel.name} (ID: ${channel.id})`,
  }));

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: 'var(--semi-color-bg-0)' }}>
      {/* Header */}
      <div className='mb-6'>
        <div className='flex items-center gap-2 mb-4'>
          <BarChart3 size={24} />
          <h1 className='text-2xl font-bold m-0'>
            {t('渠道统计')}
          </h1>
        </div>

        {/* Filters and Actions */}
        <Card bordered={false} bodyStyle={{ padding: '16px' }}>
          <div className='flex flex-col gap-4'>
            {/* First Row: Time and Channel Filters */}
            <div className='flex flex-wrap gap-4'>
              <Space>
                <span className='text-sm font-medium'>{t('时间范围')}:</span>
                <Select
                  value={timeRange}
                  onChange={setTimeRange}
                  style={{ width: 150 }}
                  optionList={timeRangeOptions}
                />
                {timeRange === TIME_RANGE_PRESETS.CUSTOM && (
                  <DatePicker
                    type='dateTimeRange'
                    value={customTimeRange}
                    onChange={setCustomTimeRange}
                    style={{ width: 350 }}
                  />
                )}
              </Space>

              <Space>
                <span className='text-sm font-medium'>{t('筛选渠道')}:</span>
                <Select
                  multiple
                  value={selectedChannelIds}
                  onChange={setSelectedChannelIds}
                  style={{ width: 300 }}
                  optionList={channelOptions}
                  placeholder={t('全部渠道')}
                  maxTagCount={2}
                />
              </Space>

              <Space>
                <span className='text-sm font-medium'>{t('时间粒度')}:</span>
                <Select
                  value={timeGranularity}
                  onChange={setTimeGranularity}
                  style={{ width: 120 }}
                  optionList={TIME_GRANULARITY_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: t(opt.label),
                  }))}
                />
              </Space>
            </div>

            {/* Second Row: Actions */}
            <div className='flex flex-wrap gap-4 items-center'>
              <Button
                icon={<RefreshCw size={16} />}
                onClick={refreshAllData}
                loading={loading}
              >
                {t('刷新')}
              </Button>

              <Button
                icon={<Download size={16} />}
                onClick={() => exportData(EXPORT_FORMATS.CSV)}
                disabled={loading}
              >
                {t('导出CSV')}
              </Button>

              <Button
                onClick={() => exportData(EXPORT_FORMATS.JSON)}
                disabled={loading}
              >
                {t('导出JSON')}
              </Button>

              <div className='flex items-center gap-2 ml-auto'>
                <span className='text-sm'>{t('自动刷新')}:</span>
                <Switch
                  checked={autoRefreshEnabled}
                  onChange={setAutoRefreshEnabled}
                />
                {autoRefreshEnabled && (
                  <Select
                    value={autoRefreshInterval}
                    onChange={setAutoRefreshInterval}
                    style={{ width: 120 }}
                    size='small'
                    optionList={AUTO_REFRESH_INTERVALS.map((opt) => ({
                      value: opt.value,
                      label: t(opt.label),
                    }))}
                  />
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Spin spinning={loading}>
        {/* Stats Cards */}
        <div className='mb-6'>
          <StatsCards performanceData={performanceData} loading={loading} t={t} />
        </div>

        {/* Charts Panel */}
        <div className='mb-6'>
          <ChartsPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            responseTimeChartSpec={responseTimeChartSpec}
            successRateChartSpec={successRateChartSpec}
            callCountChartSpec={callCountChartSpec}
            usageTrendChartSpec={usageTrendChartSpec}
            healthScoreChartSpec={healthScoreChartSpec}
            errorAnalysisChartSpec={errorAnalysisChartSpec}
            quotaTrendChartSpec={quotaTrendChartSpec}
            performanceData={performanceData}
            usageData={usageData}
            healthData={healthData}
            errorData={errorData}
            t={t}
          />
        </div>

        {/* Realtime Monitor */}
        {autoRefreshEnabled && (
          <div className='mb-6'>
            <RealtimeMonitor realtimeData={realtimeData} t={t} />
          </div>
        )}

        {/* Comparison Table */}
        <div className='mb-6'>
          <ComparisonTable performanceData={performanceData} t={t} />
        </div>
      </Spin>
    </div>
  );
};

export default ChannelStats;
