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
import { Progress, Divider, Empty } from '@douyinfe/semi-ui';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
import {
  timestamp2string,
  timestamp2string1,
  isDataCrossYear,
  copy,
  showSuccess,
} from './utils';
import {
  STORAGE_KEYS,
  DEFAULT_TIME_INTERVALS,
  DASHBOARD_QUICK_RANGE_CONFIGS,
  DEFAULTS,
  ILLUSTRATION_SIZE,
} from '../constants/dashboard.constants';

// ========== 时间相关工具函数 ==========
// normalizeDefaultTime normalizes a persisted dashboard granularity value.
export const normalizeDefaultTime = (timeType) => {
  return DEFAULT_TIME_INTERVALS[timeType] ? timeType : 'hour';
};

// getDefaultTime returns the normalized dashboard granularity from local storage.
export const getDefaultTime = () => {
  return normalizeDefaultTime(
    localStorage.getItem(STORAGE_KEYS.DATA_EXPORT_DEFAULT_TIME),
  );
};

const VALID_RANGE_PRESETS = new Set(['24h', '7d', '30d', '90d', 'custom']);

// getDashboardQuickRangeConfig returns the predefined dashboard quick-range config.
export const getDashboardQuickRangeConfig = (preset) => {
  return DASHBOARD_QUICK_RANGE_CONFIGS[preset] || null;
};

// parseDashboardTimestamp parses a dashboard datetime string into a local timestamp.
export const parseDashboardTimestamp = (timestamp) => {
  if (typeof timestamp !== 'string') {
    return NaN;
  }

  const match = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) {
    return NaN;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const parsedDate = new Date(year, month - 1, day, hour, minute, second);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day ||
    parsedDate.getHours() !== hour ||
    parsedDate.getMinutes() !== minute ||
    parsedDate.getSeconds() !== second
  ) {
    return NaN;
  }

  return parsedDate.getTime();
};

const isValidStoredChartRange = (range) => {
  if (!range || typeof range !== 'object') {
    return false;
  }

  const { start_timestamp, end_timestamp, default_time, preset } = range;
  const startTime = parseDashboardTimestamp(start_timestamp);
  const endTime = parseDashboardTimestamp(end_timestamp);

  return (
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startTime < endTime &&
    default_time === normalizeDefaultTime(default_time) &&
    (!preset || VALID_RANGE_PRESETS.has(preset))
  );
};

// getStoredChartRange reads and sanitizes the persisted dashboard chart range.
export const getStoredChartRange = () => {
  const storedRange = localStorage.getItem(STORAGE_KEYS.DASHBOARD_CHART_RANGE);
  if (!storedRange) {
    return null;
  }

  try {
    const parsedRange = JSON.parse(storedRange);
    if (isValidStoredChartRange(parsedRange)) {
      return parsedRange;
    }
  } catch (error) {
    // Ignore invalid persisted values and reset them below.
  }

  localStorage.removeItem(STORAGE_KEYS.DASHBOARD_CHART_RANGE);
  return null;
};

// setStoredChartRange validates and persists the current dashboard chart range.
export const setStoredChartRange = (range) => {
  if (!isValidStoredChartRange(range)) {
    localStorage.removeItem(STORAGE_KEYS.DASHBOARD_CHART_RANGE);
    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.DASHBOARD_CHART_RANGE,
    JSON.stringify(range),
  );
};

// getTimeInterval returns the dashboard aggregation interval in minutes or seconds.
export const getTimeInterval = (timeType, isSeconds = false) => {
  const intervals =
    DEFAULT_TIME_INTERVALS[timeType] || DEFAULT_TIME_INTERVALS.hour;
  return isSeconds ? intervals.seconds : intervals.minutes;
};

// getInitialTimestamp computes the default chart start time for a given end time.
export const getInitialTimestamp = (endTimestamp) => {
  const defaultTime = normalizeDefaultTime(getDefaultTime());
  const parsedEndTimestamp = parseDashboardTimestamp(endTimestamp) / 1000;
  const baseTimestamp = Number.isFinite(parsedEndTimestamp)
    ? parsedEndTimestamp
    : new Date().getTime() / 1000;

  switch (defaultTime) {
    case 'hour':
      return timestamp2string(baseTimestamp - 86400);
    case 'week':
      return timestamp2string(baseTimestamp - 86400 * 30);
    default:
      return timestamp2string(baseTimestamp - 86400 * 7);
  }
};

// getInitialChartRange restores a saved range or rebuilds a fresh default window.
export const getInitialChartRange = (endTimestamp) => {
  const storedRange = getStoredChartRange();
  if (storedRange) {
    if (storedRange.preset && storedRange.preset !== 'custom') {
      const presetConfig = getDashboardQuickRangeConfig(storedRange.preset);
      const parsedEndTimestamp = parseDashboardTimestamp(endTimestamp) / 1000;

      if (presetConfig && Number.isFinite(parsedEndTimestamp)) {
        return {
          start_timestamp: timestamp2string(
            parsedEndTimestamp - presetConfig.seconds,
          ),
          end_timestamp: endTimestamp,
          default_time: presetConfig.defaultTime,
          preset: storedRange.preset,
        };
      }
    }

    return storedRange;
  }

  const defaultTime = normalizeDefaultTime(getDefaultTime());
  return {
    start_timestamp: getInitialTimestamp(endTimestamp),
    end_timestamp: endTimestamp,
    default_time: defaultTime,
    preset: null,
  };
};

// ========== 数据处理工具函数 ==========
// updateMapValue accumulates a numeric value into a map bucket.
export const updateMapValue = (map, key, value) => {
  if (!map.has(key)) {
    map.set(key, 0);
  }
  map.set(key, map.get(key) + value);
};

// initializeMaps ensures each provided map has an initialized value for the key.
export const initializeMaps = (key, ...maps) => {
  maps.forEach((map) => {
    if (!map.has(key)) {
      map.set(key, 0);
    }
  });
};

// ========== 图表相关工具函数 ==========
// updateChartSpec applies new values, subtitle, and colors to a chart spec.
export const updateChartSpec = (
  setterFunc,
  newData,
  subtitle,
  newColors,
  dataId,
) => {
  setterFunc((prev) => ({
    ...prev,
    data: [{ id: dataId, values: newData }],
    title: {
      ...prev.title,
      subtext: subtitle,
    },
    color: {
      specified: newColors,
    },
  }));
};

// getTrendSpec builds the compact trend-chart spec used by dashboard cards.
export const getTrendSpec = (data, color) => ({
  type: 'line',
  data: [{ id: 'trend', values: data.map((val, idx) => ({ x: idx, y: val })) }],
  xField: 'x',
  yField: 'y',
  height: 40,
  width: 100,
  axes: [
    {
      orient: 'bottom',
      visible: false,
    },
    {
      orient: 'left',
      visible: false,
    },
  ],
  padding: 0,
  autoFit: false,
  legends: { visible: false },
  tooltip: { visible: false },
  crosshair: { visible: false },
  line: {
    style: {
      stroke: color,
      lineWidth: 2,
    },
  },
  point: {
    visible: false,
  },
  background: {
    fill: 'transparent',
  },
});

// ========== UI 工具函数 ==========
// createSectionTitle renders a shared dashboard section title with an icon.
export const createSectionTitle = (Icon, text) => (
  <div className='flex items-center gap-2'>
    <Icon size={16} />
    {text}
  </div>
);

// createFormField renders a shared dashboard form field with common props.
export const createFormField = (Component, props, FORM_FIELD_PROPS) => (
  <Component {...FORM_FIELD_PROPS} {...props} />
);

// ========== 操作处理函数 ==========
// handleCopyUrl copies a URL and reports a translated success message.
export const handleCopyUrl = async (url, t) => {
  if (await copy(url)) {
    showSuccess(t('复制成功'));
  }
};

// handleSpeedTest opens an external speed-test page for the provided API URL.
export const handleSpeedTest = (apiUrl) => {
  const encodedUrl = encodeURIComponent(apiUrl);
  const speedTestUrl = `https://www.tcptest.cn/http/${encodedUrl}`;
  window.open(speedTestUrl, '_blank', 'noopener,noreferrer');
};

// ========== 状态映射函数 ==========
// getUptimeStatusColor returns the configured color for an uptime status code.
export const getUptimeStatusColor = (status, uptimeStatusMap) =>
  uptimeStatusMap[status]?.color || '#8b9aa7';

// getUptimeStatusText returns the translated display text for an uptime status code.
export const getUptimeStatusText = (status, uptimeStatusMap, t) =>
  uptimeStatusMap[status]?.text || t('未知');

// ========== 监控列表渲染函数 ==========
// renderMonitorList renders the grouped uptime monitor list for the dashboard.
export const renderMonitorList = (
  monitors,
  getUptimeStatusColor,
  getUptimeStatusText,
  t,
) => {
  if (!monitors || monitors.length === 0) {
    return (
      <div className='flex justify-center items-center py-4'>
        <Empty
          image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
          darkModeImage={
            <IllustrationConstructionDark style={ILLUSTRATION_SIZE} />
          }
          title={t('暂无监控数据')}
        />
      </div>
    );
  }

  const grouped = {};
  monitors.forEach((m) => {
    const g = m.group || '';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(m);
  });

  const renderItem = (monitor, idx) => (
    <div key={idx} className='p-2 hover:bg-white rounded-lg transition-colors'>
      <div className='flex items-center justify-between mb-1'>
        <div className='flex items-center gap-2'>
          <div
            className='w-2 h-2 rounded-full flex-shrink-0'
            style={{ backgroundColor: getUptimeStatusColor(monitor.status) }}
          />
          <span className='text-sm font-medium text-gray-900'>
            {monitor.name}
          </span>
        </div>
        <span className='text-xs text-gray-500'>
          {((monitor.uptime || 0) * 100).toFixed(2)}%
        </span>
      </div>
      <div className='flex items-center gap-2'>
        <span className='text-xs text-gray-500'>
          {getUptimeStatusText(monitor.status)}
        </span>
        <div className='flex-1'>
          <Progress
            percent={(monitor.uptime || 0) * 100}
            showInfo={false}
            aria-label={`${monitor.name} uptime`}
            stroke={getUptimeStatusColor(monitor.status)}
          />
        </div>
      </div>
    </div>
  );

  return Object.entries(grouped).map(([gname, list]) => (
    <div key={gname || 'default'} className='mb-2'>
      {gname && (
        <>
          <div className='text-md font-semibold text-gray-500 px-2 py-1'>
            {gname}
          </div>
          <Divider />
        </>
      )}
      {list.map(renderItem)}
    </div>
  ));
};

// ========== 数据处理函数 ==========
// processRawData aggregates raw quota rows into dashboard summary structures.
export const processRawData = (
  data,
  dataExportDefaultTime,
  initializeMaps,
  updateMapValue,
) => {
  const result = {
    totalQuota: 0,
    totalTimes: 0,
    totalTokens: 0,
    uniqueModels: new Set(),
    timePoints: [],
    timeQuotaMap: new Map(),
    timeTokensMap: new Map(),
    timeCountMap: new Map(),
  };

  // 检查数据是否跨年
  const showYear = isDataCrossYear(data.map((item) => item.created_at));

  data.forEach((item) => {
    result.uniqueModels.add(item.model_name);
    result.totalTokens += item.token_used;
    result.totalQuota += item.quota;
    result.totalTimes += item.count;

    const timeKey = timestamp2string1(
      item.created_at,
      dataExportDefaultTime,
      showYear,
    );
    if (!result.timePoints.includes(timeKey)) {
      result.timePoints.push(timeKey);
    }

    initializeMaps(
      timeKey,
      result.timeQuotaMap,
      result.timeTokensMap,
      result.timeCountMap,
    );
    updateMapValue(result.timeQuotaMap, timeKey, item.quota);
    updateMapValue(result.timeTokensMap, timeKey, item.token_used);
    updateMapValue(result.timeCountMap, timeKey, item.count);
  });

  result.timePoints.sort();
  return result;
};

// calculateTrendData converts aggregated series into dashboard trend datasets.
export const calculateTrendData = (
  timePoints,
  timeQuotaMap,
  timeTokensMap,
  timeCountMap,
  dataExportDefaultTime,
) => {
  const quotaTrend = timePoints.map((time) => timeQuotaMap.get(time) || 0);
  const tokensTrend = timePoints.map((time) => timeTokensMap.get(time) || 0);
  const countTrend = timePoints.map((time) => timeCountMap.get(time) || 0);

  const rpmTrend = [];
  const tpmTrend = [];

  if (timePoints.length >= 2) {
    const interval = getTimeInterval(dataExportDefaultTime);

    for (let i = 0; i < timePoints.length; i++) {
      rpmTrend.push(timeCountMap.get(timePoints[i]) / interval);
      tpmTrend.push(timeTokensMap.get(timePoints[i]) / interval);
    }
  }

  return {
    balance: [],
    usedQuota: [],
    requestCount: [],
    times: countTrend,
    consumeQuota: quotaTrend,
    tokens: tokensTrend,
    rpm: rpmTrend,
    tpm: tpmTrend,
  };
};

// aggregateDataByTimeAndModel groups raw rows by time bucket and model name.
export const aggregateDataByTimeAndModel = (data, dataExportDefaultTime) => {
  const aggregatedData = new Map();

  // 检查数据是否跨年
  const showYear = isDataCrossYear(data.map((item) => item.created_at));

  data.forEach((item) => {
    const timeKey = timestamp2string1(
      item.created_at,
      dataExportDefaultTime,
      showYear,
    );
    const modelKey = item.model_name;
    const key = `${timeKey}-${modelKey}`;

    if (!aggregatedData.has(key)) {
      aggregatedData.set(key, {
        time: timeKey,
        model: modelKey,
        quota: 0,
        count: 0,
      });
    }

    const existing = aggregatedData.get(key);
    existing.quota += item.quota;
    existing.count += item.count;
  });

  return aggregatedData;
};

// generateChartTimePoints ensures enough ordered time buckets exist for chart rendering.
export const generateChartTimePoints = (
  aggregatedData,
  data,
  dataExportDefaultTime,
) => {
  let chartTimePoints = Array.from(
    new Set([...aggregatedData.values()].map((d) => d.time)),
  );

  if (chartTimePoints.length < DEFAULTS.MAX_TREND_POINTS) {
    const lastTime = Math.max(...data.map((item) => item.created_at));
    const interval = getTimeInterval(dataExportDefaultTime, true);

    // 生成时间点数组，用于检查是否跨年
    const generatedTimestamps = Array.from(
      { length: DEFAULTS.MAX_TREND_POINTS },
      (_, i) => lastTime - (6 - i) * interval,
    );
    const showYear = isDataCrossYear(generatedTimestamps);

    chartTimePoints = generatedTimestamps.map((ts) =>
      timestamp2string1(ts, dataExportDefaultTime, showYear),
    );
  }

  return chartTimePoints;
};
