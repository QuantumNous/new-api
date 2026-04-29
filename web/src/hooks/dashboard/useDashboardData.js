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

const createDefaultInputs = () => ({
  username: '',
  analysis_dimension: 'model_name',
  analysis_metric: 'original_quota',
  model_name: '',
  provider_key_id: '',
  start_timestamp: getInitialTimestamp(),
  end_timestamp: timestamp2string(new Date().getTime() / 1000 + 3600),
  channel: '',
  token_id: '',
  data_export_default_time: '',
});

export const useDashboardData = (userState, userDispatch, statusState) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initialized = useRef(false);

  // ========== 基础状态 ==========
  const [loading, setLoading] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const showLoading = useMinimumLoadingTime(loading);

  // ========== 输入状态 ==========
  const [inputs, setInputs] = useState(createDefaultInputs);

  const [dataExportDefaultTime, setDataExportDefaultTime] =
    useState(getDefaultTime());

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
  const now = new Date();
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

  const dimensionOptions = useMemo(
    () => [
      { label: t('模型'), value: 'model_name' },
      { label: t('上游 Key ID'), value: 'provider_key_id' },
      { label: t('渠道 ID'), value: 'channel_id' },
      { label: t('令牌 ID'), value: 'token_id' },
    ],
    [t],
  );

  const metricOptions = useMemo(
    () => [
      { label: t('原价'), value: 'original_quota' },
      { label: t('成本价'), value: 'cost_quota' },
    ],
    [t],
  );

  const analysisDimensionLabel = useMemo(
    () =>
      dimensionOptions.find(
        (option) => option.value === inputs.analysis_dimension,
      )?.label || t('模型'),
    [dimensionOptions, inputs.analysis_dimension, t],
  );

  const analysisMetricLabel = useMemo(
    () =>
      metricOptions.find((option) => option.value === inputs.analysis_metric)
        ?.label || t('原价'),
    [metricOptions, inputs.analysis_metric, t],
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
      return;
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }, []);

  const resolveSearchParams = useCallback(
    (overrideInputs, overrideDefaultTime) => {
      const mergedInputs = overrideInputs
        ? { ...inputs, ...overrideInputs }
        : inputs;
      return {
        inputs: mergedInputs,
        defaultTime: overrideDefaultTime ?? dataExportDefaultTime,
      };
    },
    [inputs, dataExportDefaultTime],
  );

  // ========== API 调用函数 ==========
  const loadQuotaData = useCallback(
    async (overrideInputs, overrideDefaultTime) => {
      setLoading(true);
      try {
        const {
          inputs: {
            start_timestamp,
            end_timestamp,
            username,
            analysis_dimension,
            analysis_metric,
            model_name,
            provider_key_id,
            channel,
            token_id,
          },
          defaultTime,
        } = resolveSearchParams(overrideInputs, overrideDefaultTime);
        let localStartTimestamp = Date.parse(start_timestamp) / 1000;
        let localEndTimestamp = Date.parse(end_timestamp) / 1000;
        const params = new URLSearchParams({
          start_timestamp: String(localStartTimestamp),
          end_timestamp: String(localEndTimestamp),
          default_time: defaultTime,
          dimension: analysis_dimension || 'model_name',
          metric: analysis_metric || 'original_quota',
        });

        if (model_name) {
          params.set('model_name', model_name);
        }
        if (provider_key_id) {
          params.set('provider_key_id', provider_key_id);
        }
        if (channel) {
          params.set('channel', channel);
        }
        if (token_id) {
          params.set('token_id', token_id);
        }
        if (isAdminUser && username) {
          params.set('username', username);
        }

        if (isAdminUser) {
          const url = `/api/data/?${params.toString()}`;
          const res = await API.get(url);
          const { success, message, data } = res.data;
          if (success) {
            setQuotaData(data);
            if (data.length === 0) {
              data.push({
                count: 0,
                model_name: t('无数据'),
                quota: 0,
                created_at: now.getTime() / 1000,
              });
            }
            data.sort((a, b) => a.created_at - b.created_at);
            return data;
          } else {
            showError(message);
            return [];
          }
        } else {
          const url = `/api/data/self/?${params.toString()}`;
          const res = await API.get(url);
          const { success, message, data } = res.data;
          if (success) {
            setQuotaData(data);
            if (data.length === 0) {
              data.push({
                count: 0,
                model_name: t('无数据'),
                quota: 0,
                created_at: now.getTime() / 1000,
              });
            }
            data.sort((a, b) => a.created_at - b.created_at);
            return data;
          } else {
            showError(message);
            return [];
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [isAdminUser, now, resolveSearchParams, t],
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

  const loadUserQuotaData = useCallback(
    async (overrideInputs) => {
      if (!isAdminUser) return [];
      try {
        const {
          inputs: {
            start_timestamp,
            end_timestamp,
            username,
            model_name,
            provider_key_id,
            channel,
            token_id,
            analysis_metric,
          },
        } = resolveSearchParams(overrideInputs);
        const localStartTimestamp = Date.parse(start_timestamp) / 1000;
        const localEndTimestamp = Date.parse(end_timestamp) / 1000;
        const params = new URLSearchParams({
          start_timestamp: String(localStartTimestamp),
          end_timestamp: String(localEndTimestamp),
          metric: analysis_metric || 'original_quota',
        });
        if (username) {
          params.set('username', username);
        }
        if (model_name) {
          params.set('model_name', model_name);
        }
        if (provider_key_id) {
          params.set('provider_key_id', provider_key_id);
        }
        if (channel) {
          params.set('channel', channel);
        }
        if (token_id) {
          params.set('token_id', token_id);
        }
        const url = `/api/data/users?${params.toString()}`;
        const res = await API.get(url);
        const { success, message, data } = res.data;
        if (success) {
          return data || [];
        } else {
          showError(message);
          return [];
        }
      } catch (err) {
        console.error(err);
        return [];
      }
    },
    [isAdminUser, resolveSearchParams],
  );

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
    async (overrideInputs, overrideDefaultTime) => {
      const data = await loadQuotaData(overrideInputs, overrideDefaultTime);
      await loadUptimeData();
      return data;
    },
    [loadQuotaData, loadUptimeData],
  );

  const handleSearchConfirm = useCallback(
    async (updateChartDataCallback, overrideInputs, overrideDefaultTime) => {
      const data = await refresh(overrideInputs, overrideDefaultTime);
      if (data && data.length > 0 && updateChartDataCallback) {
        updateChartDataCallback(data);
      }
    },
    [refresh],
  );

  const resetFilters = useCallback(() => {
    const nextInputs = createDefaultInputs();
    const nextDefaultTime = getDefaultTime();
    setInputs(nextInputs);
    setDataExportDefaultTime(nextDefaultTime);
    localStorage.setItem('data_export_default_time', nextDefaultTime);
    return {
      inputs: nextInputs,
      dataExportDefaultTime: nextDefaultTime,
    };
  }, []);

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

    // 输入状态
    inputs,
    dataExportDefaultTime,

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
    dimensionOptions,
    metricOptions,
    analysisDimensionLabel,
    analysisMetricLabel,
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
    loadQuotaData,
    loadUserQuotaData,
    loadUptimeData,
    getUserData,
    refresh,
    handleSearchConfirm,
    resetFilters,

    // 导航和翻译
    navigate,
    t,
    isMobile,
  };
};
