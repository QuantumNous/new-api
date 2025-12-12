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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import {
  TIME_RANGE_PRESETS,
  TIME_GRANULARITY_OPTIONS,
  AUTO_REFRESH_INTERVALS,
  STATS_TYPES,
} from '../../constants/channelStats.constants';

export const useChannelStatsData = () => {
  const { t } = useTranslation();

  // ========== 基础状态 ==========
  const [loading, setLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [realtimeData, setRealtimeData] = useState([]);
  const [errorData, setErrorData] = useState([]);

  // ========== 筛选条件 ==========
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [allChannels, setAllChannels] = useState([]);
  const [timeRange, setTimeRange] = useState(TIME_RANGE_PRESETS.LAST_7_DAYS);
  const [customTimeRange, setCustomTimeRange] = useState([null, null]);
  const [timeGranularity, setTimeGranularity] = useState('day');

  // ========== 自动刷新 ==========
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60000); // 默认1分钟
  const refreshTimerRef = useRef(null);

  // ========== Tab状态 ==========
  const [activeTab, setActiveTab] = useState('performance');

  // ========== 辅助函数 ==========
  const getTodayStartTimestamp = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor(now.getTime() / 1000);
  };

  const getTimestampRange = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    let startTimestamp, endTimestamp;

    switch (timeRange) {
      case TIME_RANGE_PRESETS.TODAY:
        startTimestamp = getTodayStartTimestamp();
        endTimestamp = now;
        break;
      case TIME_RANGE_PRESETS.LAST_7_DAYS:
        startTimestamp = now - 7 * 24 * 60 * 60;
        endTimestamp = now;
        break;
      case TIME_RANGE_PRESETS.LAST_30_DAYS:
        startTimestamp = now - 30 * 24 * 60 * 60;
        endTimestamp = now;
        break;
      case TIME_RANGE_PRESETS.CUSTOM:
        if (customTimeRange[0] && customTimeRange[1]) {
          startTimestamp = Math.floor(new Date(customTimeRange[0]).getTime() / 1000);
          endTimestamp = Math.floor(new Date(customTimeRange[1]).getTime() / 1000);
        } else {
          startTimestamp = now - 7 * 24 * 60 * 60;
          endTimestamp = now;
        }
        break;
      default:
        startTimestamp = now - 7 * 24 * 60 * 60;
        endTimestamp = now;
    }

    return { startTimestamp, endTimestamp };
  }, [timeRange, customTimeRange]);

  // ========== 数据加载函数 ==========
  const loadChannelList = useCallback(async () => {
    try {
      const res = await API.get('/api/channel/?p=0&page_size=1000');
      if (res.data.success) {
        setAllChannels(res.data.data.items || []);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  }, []);

  const loadPerformanceData = useCallback(async () => {
    setLoading(true);
    try {
      const { startTimestamp, endTimestamp } = getTimestampRange();
      const channelIdsParam = selectedChannelIds.length > 0 
        ? `&channel_ids=${selectedChannelIds.join(',')}` 
        : '';

      const url = `/api/channel/stats/performance?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}${channelIdsParam}`;

      const res = await API.get(url);
      if (res.data.success) {
        setPerformanceData(res.data.data || []);
      } else {
        showError(res.data.message || t('加载性能数据失败'));
      }
    } catch (error) {
      showError(t('加载性能数据失败'));
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  }, [getTimestampRange, selectedChannelIds, t]);

  const loadUsageData = useCallback(async () => {
    setLoading(true);
    try {
      const { startTimestamp, endTimestamp } = getTimestampRange();
      const channelIdsParam = selectedChannelIds.length > 0 
        ? `&channel_ids=${selectedChannelIds.join(',')}` 
        : '';

      const url = `/api/channel/stats/usage?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}&time_granularity=${timeGranularity}${channelIdsParam}`;

      const res = await API.get(url);
      if (res.data.success) {
        setUsageData(res.data.data || []);
      } else {
        showError(res.data.message || t('加载使用数据失败'));
      }
    } catch (error) {
      showError(t('加载使用数据失败'));
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  }, [getTimestampRange, selectedChannelIds, timeGranularity, t]);

  const loadHealthData = useCallback(async () => {
    setLoading(true);
    try {
      const { startTimestamp, endTimestamp } = getTimestampRange();
      const channelIdsParam = selectedChannelIds.length > 0 
        ? `&channel_ids=${selectedChannelIds.join(',')}` 
        : '';

      const url = `/api/channel/stats/health?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}${channelIdsParam}`;

      const res = await API.get(url);
      if (res.data.success) {
        setHealthData(res.data.data || []);
      } else {
        showError(res.data.message || t('加载健康数据失败'));
      }
    } catch (error) {
      showError(t('加载健康数据失败'));
      console.error('Failed to load health data:', error);
    } finally {
      setLoading(false);
    }
  }, [getTimestampRange, selectedChannelIds, t]);

  const loadRealtimeData = useCallback(async () => {
    try {
      const channelIdsParam = selectedChannelIds.length > 0 
        ? `?channel_ids=${selectedChannelIds.join(',')}` 
        : '';

      const url = `/api/channel/stats/realtime${channelIdsParam}`;

      const res = await API.get(url);
      if (res.data.success) {
        setRealtimeData(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load realtime data:', error);
    }
  }, [selectedChannelIds]);

  const loadErrorData = useCallback(async () => {
    setLoading(true);
    try {
      const { startTimestamp, endTimestamp } = getTimestampRange();
      const channelIdsParam = selectedChannelIds.length > 0 
        ? `&channel_ids=${selectedChannelIds.join(',')}` 
        : '';

      const url = `/api/channel/stats/errors?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}&time_granularity=${timeGranularity}${channelIdsParam}`;

      const res = await API.get(url);
      if (res.data.success) {
        setErrorData(res.data.data || []);
      } else {
        showError(res.data.message || t('加载错误数据失败'));
      }
    } catch (error) {
      showError(t('加载错误数据失败'));
      console.error('Failed to load error data:', error);
    } finally {
      setLoading(false);
    }
  }, [getTimestampRange, selectedChannelIds, timeGranularity, t]);

  // ========== 刷新所有数据 ==========
  const refreshAllData = useCallback(async () => {
    await Promise.all([
      loadPerformanceData(),
      loadUsageData(),
      loadHealthData(),
      loadRealtimeData(),
      loadErrorData(),
    ]);
  }, [loadPerformanceData, loadUsageData, loadHealthData, loadRealtimeData, loadErrorData]);

  // ========== 导出数据 ==========
  const exportData = useCallback(async (format = 'csv') => {
    try {
      const { startTimestamp, endTimestamp } = getTimestampRange();
      const channelIdsParam = selectedChannelIds.length > 0 
        ? `&channel_ids=${selectedChannelIds.join(',')}` 
        : '';

      const url = `/api/channel/stats/export?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}&format=${format}${channelIdsParam}`;

      if (format === 'csv') {
        // 使用 API 请求下载 CSV，确保携带认证 token
        const res = await API.get(url, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'text/csv; charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `channel_stats_${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        showSuccess(t('导出成功'));
      } else {
        const res = await API.get(url);
        if (res.data.success) {
          const dataStr = JSON.stringify(res.data.data, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const downloadUrl = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `channel_stats_${Date.now()}.json`;
          link.click();
          URL.revokeObjectURL(downloadUrl);
          showSuccess(t('导出成功'));
        }
      }
    } catch (error) {
      showError(t('导出失败'));
      console.error('Failed to export data:', error);
    }
  }, [getTimestampRange, selectedChannelIds, t]);

  // ========== 自动刷新逻辑 ==========
  useEffect(() => {
    if (autoRefreshEnabled && autoRefreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        loadRealtimeData();
      }, autoRefreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefreshEnabled, autoRefreshInterval, loadRealtimeData]);

  // ========== 初始化 ==========
  useEffect(() => {
    loadChannelList();
  }, [loadChannelList]);

  useEffect(() => {
    refreshAllData();
  }, [timeRange, customTimeRange, selectedChannelIds, timeGranularity]);

  return {
    // 数据
    performanceData,
    usageData,
    healthData,
    realtimeData,
    errorData,
    allChannels,

    // 状态
    loading,
    activeTab,
    setActiveTab,

    // 筛选条件
    selectedChannelIds,
    setSelectedChannelIds,
    timeRange,
    setTimeRange,
    customTimeRange,
    setCustomTimeRange,
    timeGranularity,
    setTimeGranularity,

    // 自动刷新
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    autoRefreshInterval,
    setAutoRefreshInterval,

    // 方法
    refreshAllData,
    exportData,
    loadPerformanceData,
    loadUsageData,
    loadHealthData,
    loadRealtimeData,
    loadErrorData,

    // 辅助数据
    t,
  };
};

