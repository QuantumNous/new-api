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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, showError, timestamp2string } from '../../helpers';
import { getDefaultTime, getInitialTimestamp } from '../../helpers/dashboard';
import { TIME_OPTIONS } from '../../constants/dashboard.constants';
import { useIsMobile } from '../common/useIsMobile';
import { useMinimumLoadingTime } from '../common/useMinimumLoadingTime';

const END_TIME_BUFFER_SECONDS = 3600;

export const useDashboardData = (userState, userDispatch, statusState) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initialized = useRef(false);

  // Keep a small buffer so the latest records are not clipped near "now".
  const getCurrentEndTimestamp = useCallback(
    () => timestamp2string(new Date().getTime() / 1000 + END_TIME_BUFFER_SECONDS),
    [],
  );

  const getQuickRangeConfig = useCallback((preset) => {
    const configs = {
      '24h': { seconds: 86400, granularity: 'hour' },
      '7d': { seconds: 86400 * 7, granularity: 'day' },
      '30d': { seconds: 86400 * 30, granularity: 'day' },
      '90d': { seconds: 86400 * 90, granularity: 'week' },
    };
    return configs[preset] || null;
  }, []);

  const detectQuickRangePreset = useCallback(
    (startTimestamp, endTimestamp, granularity) => {
      const diffSeconds =
        (Date.parse(endTimestamp) - Date.parse(startTimestamp)) / 1000;
      const toleranceSeconds = 3600;
      const presets = ['24h', '7d', '30d', '90d'];
      for (const preset of presets) {
        const config = getQuickRangeConfig(preset);
        if (!config || config.granularity !== granularity) {
          continue;
        }
        if (Math.abs(diffSeconds - config.seconds) <= toleranceSeconds) {
          return preset;
        }
      }
      return 'custom';
    },
    [getQuickRangeConfig],
  );

  const isValidCustomRange = useCallback((startTimestamp, endTimestamp) => {
    const startTime = Date.parse(startTimestamp);
    const endTime = Date.parse(endTimestamp);
    return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime < endTime;
  }, []);

  const initialChartRange = useMemo(() => {
    const defaultTime = getDefaultTime();
    const endTimestamp = getCurrentEndTimestamp();

    return {
      start_timestamp: getInitialTimestamp(endTimestamp),
      end_timestamp: endTimestamp,
      default_time: defaultTime,
    };
  }, [getCurrentEndTimestamp]);

  // ========== 基础状态 ==========
  const [loading, setLoading] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const showLoading = useMinimumLoadingTime(loading);

  // ========== 输入状态 ==========
  const [inputs, setInputs] = useState({
    username: '',
    token_name: '',
    model_name: '',
    start_timestamp: initialChartRange.start_timestamp,
    end_timestamp: initialChartRange.end_timestamp,
    channel: '',
    data_export_default_time: '',
  });

  const [dataExportDefaultTime, setDataExportDefaultTime] =
    useState(initialChartRange.default_time);
  const [activeRangePreset, setActiveRangePreset] = useState(() =>
    detectQuickRangePreset(
      initialChartRange.start_timestamp,
      initialChartRange.end_timestamp,
      initialChartRange.default_time,
    ),
  );
  const [customRangeDraft, setCustomRangeDraft] = useState(() => initialChartRange);

  // ========== 数据状态 ==========
  const [quotaData, setQuotaData] = useState([]);
  const [consumeQuota, setConsumeQuota] = useState(0);
  const [consumeTokens, setConsumeTokens] = useState(0);
  const [times, setTimes] = useState(0);
  const [pieData, setPieData] = useState([{ type: 'null', value: '0' }]);
  const [lineData, setLineData] = useState([]);
  const [modelColors, setModelColors] = useState({});

  // ========== 图表状态 ==========
  const [activeChartTab, setActiveChartTab] = useState('1');

  // ========== 趋势数据 ==========
  const [trendData, setTrendData] = useState({
    balance: [],
    usedQuota: [],
    requestCount: [],
    times: [],
    consumeQuota: [],
    tokens: [],
    rpm: [],
    tpm: [],
  });

  // ========== Uptime 数据 ==========
  const [uptimeData, setUptimeData] = useState([]);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [activeUptimeTab, setActiveUptimeTab] = useState('');

  // ========== 常量 ==========
  const isAdminUser = isAdmin();

  // ========== Panel enable flags ==========
  const apiInfoEnabled = statusState?.status?.api_info_enabled ?? true;
  const announcementsEnabled =
    statusState?.status?.announcements_enabled ?? true;
  const faqEnabled = statusState?.status?.faq_enabled ?? true;
  const uptimeEnabled = statusState?.status?.uptime_kuma_enabled ?? true;

  const hasApiInfoPanel = apiInfoEnabled;
  const hasInfoPanels = announcementsEnabled || faqEnabled || uptimeEnabled;

  // ========== Memoized Values ==========
  const timeOptions = useMemo(
    () =>
      TIME_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t],
  );

  const quickRangeOptions = useMemo(
    () => [
      { label: t('最近24小时'), value: '24h' },
      { label: t('最近7天'), value: '7d' },
      { label: t('最近30天'), value: '30d' },
      { label: t('最近90天'), value: '90d' },
    ],
    [t],
  );

  const performanceMetrics = useMemo(() => {
    const { start_timestamp, end_timestamp } = inputs;
    const timeDiff =
      (Date.parse(end_timestamp) - Date.parse(start_timestamp)) / 60000;
    const avgRPM = isNaN(times / timeDiff)
      ? '0'
      : (times / timeDiff).toFixed(3);
    const avgTPM = isNaN(consumeTokens / timeDiff)
      ? '0'
      : (consumeTokens / timeDiff).toFixed(3);

    return { avgRPM, avgTPM, timeDiff };
  }, [times, consumeTokens, inputs.start_timestamp, inputs.end_timestamp]);

  const getGreeting = useMemo(() => {
    const hours = new Date().getHours();
    let greeting = '';

    if (hours >= 5 && hours < 12) {
      greeting = t('早上好');
    } else if (hours >= 12 && hours < 14) {
      greeting = t('中午好');
    } else if (hours >= 14 && hours < 18) {
      greeting = t('下午好');
    } else {
      greeting = t('晚上好');
    }

    const username = userState?.user?.username || '';
    return `👋${greeting}，${username}`;
  }, [t, userState?.user?.username]);

  // ========== 回调函数 ==========
  const handleInputChange = useCallback((value, name) => {
    if (name === 'data_export_default_time') {
      setDataExportDefaultTime(value);
      localStorage.setItem('data_export_default_time', value);
      setActiveRangePreset('custom');
      return;
    }
    if (name === 'start_timestamp' || name === 'end_timestamp') {
      setActiveRangePreset('custom');
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }, []);

  const applyChartRangePreset = useCallback(
    (preset) => {
      const config = getQuickRangeConfig(preset);
      if (!config) {
        return null;
      }
      const endTimestamp = getCurrentEndTimestamp();
      const endTimestampUnix = Date.parse(endTimestamp) / 1000;
      const nextInputs = {
        ...inputs,
        start_timestamp: timestamp2string(endTimestampUnix - config.seconds),
        end_timestamp: endTimestamp,
      };
      setInputs(nextInputs);
      setDataExportDefaultTime(config.granularity);
      setActiveRangePreset(preset);
      localStorage.setItem('data_export_default_time', config.granularity);
      setCustomRangeDraft({
        start_timestamp: nextInputs.start_timestamp,
        end_timestamp: nextInputs.end_timestamp,
        default_time: config.granularity,
      });
      return {
        nextInputs,
        nextDefaultTime: config.granularity,
      };
    },
    [getCurrentEndTimestamp, getQuickRangeConfig, inputs],
  );

  const activateCustomRange = useCallback(() => {
    setCustomRangeDraft({
      start_timestamp: inputs.start_timestamp,
      end_timestamp: inputs.end_timestamp,
      default_time: dataExportDefaultTime,
    });
    setActiveRangePreset('custom');
  }, [dataExportDefaultTime, inputs.end_timestamp, inputs.start_timestamp]);

  const handleCustomRangeChange = useCallback(
    (
      rangeValue = [
        customRangeDraft.start_timestamp,
        customRangeDraft.end_timestamp,
      ],
      nextDefaultTime = customRangeDraft.default_time,
    ) => {
      const normalizedRange = Array.isArray(rangeValue) ? rangeValue : [];
      const [startTimestamp = '', endTimestamp = ''] = normalizedRange;

      setActiveRangePreset('custom');
      setCustomRangeDraft({
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        default_time: nextDefaultTime,
      });
    },
    [
      customRangeDraft.default_time,
      customRangeDraft.end_timestamp,
      customRangeDraft.start_timestamp,
    ],
  );

  const applyCustomRange = useCallback(() => {
    const { start_timestamp, end_timestamp, default_time } = customRangeDraft;
    if (!start_timestamp || !end_timestamp) {
      return null;
    }
    if (!isValidCustomRange(start_timestamp, end_timestamp)) {
      showError(t('请求参数无效'));
      return null;
    }
    const nextInputs = {
      ...inputs,
      start_timestamp,
      end_timestamp,
    };
    setInputs(nextInputs);
    setDataExportDefaultTime(default_time);
    setActiveRangePreset('custom');
    localStorage.setItem('data_export_default_time', default_time);
    return {
      nextInputs,
      nextDefaultTime: default_time,
    };
  }, [customRangeDraft, inputs, isValidCustomRange, t]);

  const showSearchModal = useCallback(() => {
    setSearchModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSearchModalVisible(false);
  }, []);

  // ========== API 调用函数 ==========
  const loadQuotaData = useCallback(
    async (
      overrideInputs = inputs,
      overrideDefaultTime = dataExportDefaultTime,
    ) => {
      setLoading(true);
      try {
        let url = '';
        const { start_timestamp, end_timestamp, username } = overrideInputs;
        let localStartTimestamp = Date.parse(start_timestamp) / 1000;
        let localEndTimestamp = Date.parse(end_timestamp) / 1000;
        const emptyStateTimestamp = Number.isFinite(localStartTimestamp)
          ? localStartTimestamp
          : 0;

        if (isAdminUser) {
          url = `/api/data/?username=${username}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${overrideDefaultTime}`;
        } else {
          url = `/api/data/self/?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${overrideDefaultTime}`;
        }

        const res = await API.get(url);
        const { success, message, data } = res.data;
        if (success) {
          const nextData = Array.isArray(data) ? [...data] : [];
          if (nextData.length === 0) {
            nextData.push({
              count: 0,
              model_name: '无数据',
              quota: 0,
              created_at: emptyStateTimestamp,
            });
          }
          nextData.sort((a, b) => a.created_at - b.created_at);
          setQuotaData(nextData);
          return nextData;
        } else {
          showError(message);
          return [];
        }
      } finally {
        setLoading(false);
      }
    },
    [dataExportDefaultTime, inputs, isAdminUser],
  );

  const loadUptimeData = useCallback(async () => {
    setUptimeLoading(true);
    try {
      const res = await API.get('/api/uptime/status');
      const { success, message, data } = res.data;
      if (success) {
        setUptimeData(data || []);
        if (data && data.length > 0 && !activeUptimeTab) {
          setActiveUptimeTab(data[0].categoryName);
        }
      } else {
        showError(message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUptimeLoading(false);
    }
  }, [activeUptimeTab]);

  const getUserData = useCallback(async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  }, [userDispatch]);

  const refresh = useCallback(
    async (
      overrideInputs = inputs,
      overrideDefaultTime = dataExportDefaultTime,
    ) => {
      const data = await loadQuotaData(overrideInputs, overrideDefaultTime);
      await loadUptimeData();
      return data;
    },
    [dataExportDefaultTime, inputs, loadQuotaData, loadUptimeData],
  );

  const handleSearchConfirm = useCallback(
    async (updateChartDataCallback) => {
      const data = await refresh();
      if (data && data.length > 0 && updateChartDataCallback) {
        updateChartDataCallback(data);
      }
      setSearchModalVisible(false);
    },
    [refresh],
  );

  // ========== Effects ==========
  useEffect(() => {
    const timer = setTimeout(() => {
      setGreetingVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      getUserData();
      initialized.current = true;
    }
  }, [getUserData]);

  return {
    // 基础状态
    loading: showLoading,
    greetingVisible,
    searchModalVisible,

    // 输入状态
    inputs,
    dataExportDefaultTime,
    activeRangePreset,
    quickRangeOptions,
    customRangeDraft,

    // 数据状态
    quotaData,
    consumeQuota,
    setConsumeQuota,
    consumeTokens,
    setConsumeTokens,
    times,
    setTimes,
    pieData,
    setPieData,
    lineData,
    setLineData,
    modelColors,
    setModelColors,

    // 图表状态
    activeChartTab,
    setActiveChartTab,

    // 趋势数据
    trendData,
    setTrendData,

    // Uptime 数据
    uptimeData,
    uptimeLoading,
    activeUptimeTab,
    setActiveUptimeTab,

    // 计算值
    timeOptions,
    performanceMetrics,
    getGreeting,
    isAdminUser,
    hasApiInfoPanel,
    hasInfoPanels,
    apiInfoEnabled,
    announcementsEnabled,
    faqEnabled,
    uptimeEnabled,

    // 函数
    handleInputChange,
    applyChartRangePreset,
    activateCustomRange,
    handleCustomRangeChange,
    applyCustomRange,
    showSearchModal,
    handleCloseModal,
    loadQuotaData,
    loadUptimeData,
    getUserData,
    refresh,
    handleSearchConfirm,

    // 导航和翻译
    navigate,
    t,
    isMobile,
  };
};
