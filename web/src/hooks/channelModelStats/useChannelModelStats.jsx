import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

// 时间范围预设
const TIME_RANGE_PRESETS = {
  TODAY: 'today',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  CUSTOM: 'custom',
};

// 时间粒度选项
const TIME_GRANULARITY_OPTIONS = [
  { value: 'none', label: '不聚合' },
  { value: 'hour', label: '按小时' },
  { value: 'day', label: '按天' },
  { value: 'week', label: '按周' },
];

export const useChannelModelStats = () => {
  const { t } = useTranslation();

  // ========== 数据状态 ==========
  const [loading, setLoading] = useState(false);
  const [statsData, setStatsData] = useState([]);
  const [summaryData, setSummaryData] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // ========== 筛选条件 ==========
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [selectedModelNames, setSelectedModelNames] = useState([]);
  const [timeRange, setTimeRange] = useState(TIME_RANGE_PRESETS.LAST_7_DAYS);
  const [customTimeRange, setCustomTimeRange] = useState([null, null]);
  const [granularity, setGranularity] = useState('none');

  // ========== 排序状态 ==========
  const [sortBy, setSortBy] = useState('total_calls');
  const [sortOrder, setSortOrder] = useState('desc');

  // ========== 可用选项 ==========
  const [allChannels, setAllChannels] = useState([]);
  const [allModels, setAllModels] = useState([]);

  // ========== 视图状态 ==========
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'chart'
  const [activeChartTab, setActiveChartTab] = useState('response_time');

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

  // ========== 构建查询参数 ==========
  const buildQueryParams = useCallback((pageOverride = null) => {
    const { startTimestamp, endTimestamp } = getTimestampRange();
    const params = new URLSearchParams();

    params.set('start_timestamp', startTimestamp);
    params.set('end_timestamp', endTimestamp);
    params.set('granularity', granularity);
    params.set('sort_by', sortBy);
    params.set('sort_order', sortOrder);
    params.set('page', pageOverride || pagination.page);
    params.set('page_size', pagination.pageSize);

    if (selectedChannelIds.length > 0) {
      params.set('channel_ids', selectedChannelIds.join(','));
    }
    if (selectedModelNames.length > 0) {
      params.set('model_names', selectedModelNames.join(','));
    }

    return params.toString();
  }, [getTimestampRange, granularity, sortBy, sortOrder, pagination.page, pagination.pageSize, selectedChannelIds, selectedModelNames]);

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

  const loadModelList = useCallback(async () => {
    try {
      const { startTimestamp, endTimestamp } = getTimestampRange();
      const channelIdsParam = selectedChannelIds.length > 0 
        ? `&channel_ids=${selectedChannelIds.join(',')}` 
        : '';
      
      const url = `/api/channel/stats/models?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}${channelIdsParam}`;
      const res = await API.get(url);
      if (res.data.success) {
        setAllModels(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, [getTimestampRange, selectedChannelIds]);

  const loadStatsData = useCallback(async (pageOverride = null) => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams(pageOverride);
      const url = `/api/channel/stats/model-detail?${queryParams}`;
      const res = await API.get(url);
      
      if (res.data.success) {
        const data = res.data.data;
        setStatsData(data.data || []);
        setPagination(prev => ({
          ...prev,
          page: data.page,
          total: data.total,
          totalPages: data.total_pages,
        }));
      } else {
        showError(res.data.message || t('加载统计数据失败'));
      }
    } catch (error) {
      showError(t('加载统计数据失败'));
      console.error('Failed to load stats data:', error);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, t]);

  const loadSummaryData = useCallback(async () => {
    try {
      const { startTimestamp, endTimestamp } = getTimestampRange();
      const params = new URLSearchParams();
      params.set('start_timestamp', startTimestamp);
      params.set('end_timestamp', endTimestamp);
      
      if (selectedChannelIds.length > 0) {
        params.set('channel_ids', selectedChannelIds.join(','));
      }
      if (selectedModelNames.length > 0) {
        params.set('model_names', selectedModelNames.join(','));
      }

      const url = `/api/channel/stats/model-summary?${params.toString()}`;
      const res = await API.get(url);
      
      if (res.data.success) {
        setSummaryData(res.data.data || {});
      }
    } catch (error) {
      console.error('Failed to load summary data:', error);
    }
  }, [getTimestampRange, selectedChannelIds, selectedModelNames]);

  // ========== 刷新数据 ==========
  const refreshData = useCallback(async () => {
    await Promise.all([
      loadStatsData(1),
      loadSummaryData(),
      loadModelList(),
    ]);
  }, [loadStatsData, loadSummaryData, loadModelList]);

  // ========== 分页切换 ==========
  const handlePageChange = useCallback((page) => {
    setPagination(prev => ({ ...prev, page }));
    loadStatsData(page);
  }, [loadStatsData]);

  const handlePageSizeChange = useCallback((pageSize) => {
    setPagination(prev => ({ ...prev, pageSize, page: 1 }));
  }, []);

  // ========== 排序切换 ==========
  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }, [sortBy]);

  // ========== 导出数据 ==========
  const exportData = useCallback(async (format = 'csv') => {
    try {
      const queryParams = buildQueryParams(1);
      const url = `/api/channel/stats/model-export?${queryParams}&format=${format}`;

      if (format === 'csv') {
        // 使用 API 请求下载 CSV，确保携带认证 token
        const res = await API.get(url, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'text/csv; charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `channel_model_stats_${Date.now()}.csv`;
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
          link.download = `channel_model_stats_${Date.now()}.json`;
          link.click();
          URL.revokeObjectURL(downloadUrl);
          showSuccess(t('导出成功'));
        }
      }
    } catch (error) {
      showError(t('导出失败'));
      console.error('Failed to export data:', error);
    }
  }, [buildQueryParams, t]);

  // ========== 图表数据转换 ==========
  const chartData = useMemo(() => {
    if (!statsData.length) return {};

    // 响应时间百分位数据
    const responseTimeData = statsData.map(item => ({
      name: `${item.channel_name}-${item.model_name}`,
      p50: item.p50_response_time || 0,
      p90: item.p90_response_time || 0,
      p95: item.p95_response_time || 0,
      p99: item.p99_response_time || 0,
      avg: item.avg_response_time || 0,
    }));

    // Token分布数据
    const tokenData = statsData.map(item => ({
      name: `${item.channel_name}-${item.model_name}`,
      prompt_tokens: item.prompt_tokens || 0,
      completion_tokens: item.completion_tokens || 0,
      avg_prompt: item.avg_prompt_tokens || 0,
      avg_completion: item.avg_completion_tokens || 0,
    }));

    // 调用次数数据
    const callCountData = statsData.map(item => ({
      name: `${item.channel_name}-${item.model_name}`,
      total_calls: item.total_calls || 0,
      success_calls: item.success_calls || 0,
      failed_calls: item.failed_calls || 0,
      success_rate: item.success_rate || 0,
    }));

    // 趋势数据（按时间点分组）
    const trendData = {};
    statsData.forEach(item => {
      const key = item.time_point || 'all';
      if (!trendData[key]) {
        trendData[key] = [];
      }
      trendData[key].push(item);
    });

    return {
      responseTime: responseTimeData,
      token: tokenData,
      callCount: callCountData,
      trend: trendData,
    };
  }, [statsData]);

  // ========== 初始化 ==========
  useEffect(() => {
    loadChannelList();
  }, [loadChannelList]);

  useEffect(() => {
    loadModelList();
  }, [loadModelList]);

  // 筛选条件变化时重新加载数据
  useEffect(() => {
    loadStatsData(1);
    loadSummaryData();
  }, [timeRange, customTimeRange, selectedChannelIds, selectedModelNames, granularity, sortBy, sortOrder, pagination.pageSize]);

  return {
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
    activeChartTab,
    setActiveChartTab,
    
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
  };
};

export default useChannelModelStats;

