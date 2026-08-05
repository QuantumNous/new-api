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
import { API, isAdmin, showError } from '../../helpers';
import {
  formatDashboardTimestamp,
  getDefaultTime,
  getInitialTimestamp,
} from '../../helpers/dashboard';
import { TIME_OPTIONS } from '../../constants/dashboard.constants';
import { useIsMobile } from '../common/useIsMobile';
import { useMinimumLoadingTime } from '../common/useMinimumLoadingTime';
import { parseDashboardDateRange } from './time';
import { describeDashboardRangeError, validateDashboardRange } from './range';
import { getAnalysisFailureMessage, isRequestCanceled } from './analysisState';
import { createDashboardRequestGuard, runQuotaDataRequest } from './quotaState';

export const useDashboardData = (userState, userDispatch, statusState) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initialized = useRef(false);

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
    start_timestamp: getInitialTimestamp(),
    end_timestamp: formatDashboardTimestamp(new Date().getTime() / 1000 + 3600),
    channel: '',
    data_export_default_time: getDefaultTime(),
  });

  const [dataExportDefaultTime, setDataExportDefaultTime] =
    useState(getDefaultTime());

  // ========== 请求取消/陈旧结果保护 ==========
  // Every quota-series load owns a generation number and an AbortController.
  // A new load aborts the in-flight one, and only the newest generation is
  // allowed to write state, so a slow response for an old range can never
  // overwrite the numbers for the range the user is currently looking at.
  const quotaGuard = useRef(null);
  if (quotaGuard.current === null) {
    quotaGuard.current = createDashboardRequestGuard();
  }
  const userQuotaGuard = useRef(null);
  if (userQuotaGuard.current === null) {
    userQuotaGuard.current = createDashboardRequestGuard();
  }

  // ========== 数据状态 ==========
  const [quotaData, setQuotaData] = useState([]);
  const [quotaError, setQuotaError] = useState('');
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

  const performanceMetrics = useMemo(() => {
    const { start_timestamp, end_timestamp } = inputs;
    const { start, end } = parseDashboardDateRange(
      start_timestamp,
      end_timestamp,
    );
    const timeDiff = (end - start) / 60;
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
      setInputs((inputs) => ({ ...inputs, data_export_default_time: value }));
      localStorage.setItem('data_export_default_time', value);
      return;
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }, []);

  const showSearchModal = useCallback(() => {
    setSearchModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSearchModalVisible(false);
  }, []);

  // ========== API 调用函数 ==========
  const loadQuotaData = useCallback(async () => {
    const attempt = quotaGuard.current.begin();

    setLoading(true);
    setQuotaError('');
    try {
      const { start_timestamp, end_timestamp, username } = inputs;
      const { start: localStartTimestamp, end: localEndTimestamp } =
        parseDashboardDateRange(start_timestamp, end_timestamp);

      // Same bound the server enforces; reject before issuing a request that
      // could only be refused, and clear the previously displayed series.
      const rangeError = validateDashboardRange(
        localStartTimestamp,
        localEndTimestamp,
      );
      if (rangeError) {
        if (!attempt.isCurrent()) return [];
        const message = describeDashboardRangeError(rangeError, t);
        setQuotaData([]);
        setQuotaError(message);
        showError(message);
        return [];
      }

      const url = isAdminUser
        ? `/api/data/?username=${username}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`
        : `/api/data/self/?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;

      const outcome = await runQuotaDataRequest({
        // The signal is handed to the HTTP client so a superseded range is
        // cancelled at the transport, not merely ignored on arrival.
        requestQuota: async (signal) => {
          const res = await API.get(url, {
            signal,
            // This hook owns cancellation and error presentation; the global
            // interceptor must not toast a rejection we are about to replace.
            skipErrorHandler: true,
            disableDuplicate: true,
          });
          return res.data;
        },
        attempt,
        defaultFailureMessage: t('加载数据看板失败'),
        setQuotaData,
        setQuotaError,
        showError,
      });

      if (outcome.status !== 'success') return [];

      const rows = outcome.rows;
      if (rows.length === 0) {
        rows.push({
          count: 0,
          model_name: '无数据',
          quota: 0,
          created_at: now.getTime() / 1000,
        });
      }
      rows.sort((a, b) => a.created_at - b.created_at);
      return rows;
    } finally {
      if (attempt.isCurrent()) {
        setLoading(false);
        attempt.finish();
      }
    }
  }, [inputs, dataExportDefaultTime, isAdminUser, now, t]);

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

  const loadUserQuotaData = useCallback(async () => {
    if (!isAdminUser) return [];
    const attempt = userQuotaGuard.current.begin();

    const { start_timestamp, end_timestamp } = inputs;
    const { start: localStartTimestamp, end: localEndTimestamp } =
      parseDashboardDateRange(start_timestamp, end_timestamp);
    const rangeError = validateDashboardRange(
      localStartTimestamp,
      localEndTimestamp,
    );
    if (rangeError) {
      if (attempt.isCurrent()) {
        showError(describeDashboardRangeError(rangeError, t));
      }
      return [];
    }

    const url = `/api/data/users?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    try {
      const res = await API.get(url, {
        signal: attempt.signal,
        skipErrorHandler: true,
        disableDuplicate: true,
      });
      if (!attempt.isCurrent()) return [];
      const { success, message, data } = res.data;
      if (success) return data || [];
      showError(message || t('加载数据看板失败'));
      return [];
    } catch (err) {
      if (isRequestCanceled(err, attempt.signal) || !attempt.isCurrent()) {
        return [];
      }
      showError(getAnalysisFailureMessage(err, t('加载数据看板失败')));
      return [];
    } finally {
      attempt.finish();
    }
  }, [inputs, isAdminUser, t]);

  const getUserData = useCallback(async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  }, [userDispatch]);

  const refresh = useCallback(async () => {
    const data = await loadQuotaData();
    await loadUptimeData();
    return data;
  }, [loadQuotaData, loadUptimeData]);

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

  // On unmount every in-flight quota request is invalidated and aborted, so a
  // response that arrives after teardown cannot touch state.
  useEffect(
    () => () => {
      quotaGuard.current?.cancel();
      userQuotaGuard.current?.cancel();
    },
    [],
  );

  return {
    // 基础状态
    loading: showLoading,
    greetingVisible,
    searchModalVisible,

    // 输入状态
    inputs,
    dataExportDefaultTime,

    // 数据状态
    quotaData,
    quotaError,
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
    showSearchModal,
    handleCloseModal,
    loadQuotaData,
    loadUserQuotaData,
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
