import React, { useMemo } from 'react';
import { Card, Tabs, TabPane, Typography, Spin } from '@douyinfe/semi-ui';
import {
  FilterPanel,
  StatsTable,
  SummaryCards,
  ResponseTimeChart,
  TokenDistributionChart,
  TrendChart,
  CallCountChart,
  TokenRangeChart,
} from '../../components/channelModelStats';
import { useChannelModelStats } from '../../hooks/channelModelStats/useChannelModelStats';

const { Title } = Typography;

const ChannelModelStats = () => {
  const {
    // 数据
    statsData,
    summaryData,
    chartData,
    allChannels,
    allModels,
    
    // 分页
    pagination,
    handlePageChange,
    handlePageSizeChange,
    
    // 状态
    loading,
    viewMode,
    setViewMode,
    
    // 筛选条件
    selectedChannelIds,
    setSelectedChannelIds,
    selectedModelNames,
    setSelectedModelNames,
    timeRange,
    setTimeRange,
    customTimeRange,
    setCustomTimeRange,
    granularity,
    setGranularity,
    
    // 排序
    sortBy,
    sortOrder,
    handleSort,
    
    // 方法
    refreshData,
    exportData,
    getTimestampRange,
    
    // 常量
    TIME_RANGE_PRESETS,
    TIME_GRANULARITY_OPTIONS,
    
    // 翻译
    t,
  } = useChannelModelStats();

  // 缓存时间戳范围，避免重复计算
  const timestampRange = useMemo(() => {
    return getTimestampRange();
  }, [getTimestampRange]);

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <Title heading={3} style={{ marginBottom: '24px' }}>
        {t('渠道模型统计')}
      </Title>

      {/* 筛选面板 */}
      <FilterPanel
        allChannels={allChannels}
        selectedChannelIds={selectedChannelIds}
        setSelectedChannelIds={setSelectedChannelIds}
        allModels={allModels}
        selectedModelNames={selectedModelNames}
        setSelectedModelNames={setSelectedModelNames}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        customTimeRange={customTimeRange}
        setCustomTimeRange={setCustomTimeRange}
        TIME_RANGE_PRESETS={TIME_RANGE_PRESETS}
        granularity={granularity}
        setGranularity={setGranularity}
        TIME_GRANULARITY_OPTIONS={TIME_GRANULARITY_OPTIONS}
        refreshData={refreshData}
        exportData={exportData}
        loading={loading}
        t={t}
      />

      {/* 汇总卡片 */}
      <SummaryCards data={summaryData} t={t} />

      {/* 视图切换 */}
      <Card style={{ marginTop: '16px' }}>
        <Tabs
          type="button"
          activeKey={viewMode}
          onChange={setViewMode}
        >
          <TabPane tab={t('表格视图')} itemKey="table">
            <Spin spinning={loading}>
              <StatsTable
                data={statsData}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                t={t}
              />
            </Spin>
          </TabPane>
          
          <TabPane tab={t('图表视图')} itemKey="chart">
            <Spin spinning={loading}>
              <Tabs type="line" style={{ marginTop: '16px' }}>
                <TabPane tab={t('Token范围分析')} itemKey="token_range">
                  <TokenRangeChart
                    startTimestamp={timestampRange.startTimestamp}
                    endTimestamp={timestampRange.endTimestamp}
                    channelIds={selectedChannelIds}
                    modelNames={selectedModelNames}
                    t={t}
                  />
                </TabPane>

                <TabPane tab={t('响应时间')} itemKey="response_time">
                  <ResponseTimeChart 
                    data={chartData.responseTime} 
                    t={t} 
                  />
                </TabPane>
                
                <TabPane tab={t('Token分布')} itemKey="token">
                  <TokenDistributionChart 
                    data={chartData.token} 
                    t={t} 
                  />
                </TabPane>
                
                <TabPane tab={t('调用分布')} itemKey="call_count">
                  <CallCountChart 
                    data={chartData.callCount} 
                    t={t} 
                  />
                </TabPane>
                
                <TabPane tab={t('趋势分析')} itemKey="trend">
                  <TrendChart
                    startTimestamp={timestampRange.startTimestamp}
                    endTimestamp={timestampRange.endTimestamp}
                    channelIds={selectedChannelIds}
                    modelNames={selectedModelNames}
                    t={t}
                  />
                </TabPane>
              </Tabs>
            </Spin>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default ChannelModelStats;

