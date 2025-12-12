import React from 'react';
import { Select, DatePicker, Button, Space } from '@douyinfe/semi-ui';
import { IconRefresh, IconDownload } from '@douyinfe/semi-icons';

const FilterPanel = ({
  // 渠道筛选
  allChannels,
  selectedChannelIds,
  setSelectedChannelIds,
  // 模型筛选
  allModels,
  selectedModelNames,
  setSelectedModelNames,
  // 时间范围
  timeRange,
  setTimeRange,
  customTimeRange,
  setCustomTimeRange,
  TIME_RANGE_PRESETS,
  // 时间粒度
  granularity,
  setGranularity,
  TIME_GRANULARITY_OPTIONS,
  // 操作
  refreshData,
  exportData,
  loading,
  t,
}) => {
  const timeRangeOptions = [
    { value: TIME_RANGE_PRESETS.TODAY, label: t('今天') },
    { value: TIME_RANGE_PRESETS.LAST_7_DAYS, label: t('最近7天') },
    { value: TIME_RANGE_PRESETS.LAST_30_DAYS, label: t('最近30天') },
    { value: TIME_RANGE_PRESETS.CUSTOM, label: t('自定义') },
  ];

  const granularityOptions = TIME_GRANULARITY_OPTIONS.map(opt => ({
    value: opt.value,
    label: t(opt.label),
  }));

  const channelOptions = allChannels.map(channel => ({
    value: channel.id,
    label: `${channel.name} (ID: ${channel.id})`,
  }));

  const modelOptions = allModels.map(model => ({
    value: model.model_name,
    label: `${model.model_name} (${model.call_count}次)`,
  }));

  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '12px', 
      alignItems: 'center',
      padding: '16px',
      background: 'var(--semi-color-bg-1)',
      borderRadius: '8px',
      marginBottom: '16px',
    }}>
      {/* 渠道筛选 */}
      <div style={{ minWidth: '200px' }}>
        <Select
          placeholder={t('选择渠道')}
          style={{ width: '100%' }}
          multiple
          filter
          maxTagCount={2}
          value={selectedChannelIds}
          onChange={setSelectedChannelIds}
          optionList={channelOptions}
          showClear
        />
      </div>

      {/* 模型筛选 */}
      <div style={{ minWidth: '200px' }}>
        <Select
          placeholder={t('选择模型')}
          style={{ width: '100%' }}
          multiple
          filter
          maxTagCount={2}
          value={selectedModelNames}
          onChange={setSelectedModelNames}
          optionList={modelOptions}
          showClear
        />
      </div>

      {/* 时间范围 */}
      <div style={{ minWidth: '140px' }}>
        <Select
          placeholder={t('时间范围')}
          style={{ width: '100%' }}
          value={timeRange}
          onChange={setTimeRange}
          optionList={timeRangeOptions}
        />
      </div>

      {/* 自定义时间范围 */}
      {timeRange === TIME_RANGE_PRESETS.CUSTOM && (
        <div>
          <DatePicker
            type="dateTimeRange"
            style={{ width: '320px' }}
            value={customTimeRange}
            onChange={setCustomTimeRange}
            placeholder={[t('开始时间'), t('结束时间')]}
          />
        </div>
      )}

      {/* 时间粒度 */}
      <div style={{ minWidth: '120px' }}>
        <Select
          placeholder={t('时间粒度')}
          style={{ width: '100%' }}
          value={granularity}
          onChange={setGranularity}
          optionList={granularityOptions}
        />
      </div>

      {/* 操作按钮 */}
      <Space>
        <Button
          icon={<IconRefresh />}
          onClick={refreshData}
          loading={loading}
        >
          {t('刷新')}
        </Button>
        <Button
          icon={<IconDownload />}
          onClick={() => exportData('csv')}
        >
          {t('导出CSV')}
        </Button>
      </Space>
    </div>
  );
};

export default FilterPanel;


