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

const createEmptyHubSummary = () => ({
  onlineNodes: 0,
  busyNodes: 0,
  pendingTasks: 0,
  activeSchedules: 0,
  criticalAlerts: 0,
  unacknowledgedAlerts: 0,
  ai: {
    modelCount: 0,
    aiCapableNodes: 0,
    onlineAINodes: 0,
  },
  network: {
    mihomoConfigured: false,
    mihomoReachable: false,
    dnsConfigured: false,
    dnsReachable: false,
    dnsProtectionEnabled: false,
    egressIP: '',
    egressRegion: '',
    egressISP: '',
    egressSource: '',
  },
  homeAssistant: {
    configured: false,
    reachable: false,
    entityCount: 0,
  },
  primaryNode: {
    nodeID: '',
    hostname: '',
    status: '',
    ipAddress: '',
  },
});

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
    end_timestamp: timestamp2string(new Date().getTime() / 1000 + 3600),
    channel: '',
    data_export_default_time: '',
  });

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
  const [hubNodes, setHubNodes] = useState([]);
  const [hubSchedules, setHubSchedules] = useState([]);
  const [hubTasks, setHubTasks] = useState([]);
  const [hubAlerts, setHubAlerts] = useState([]);
  const [hubSummary, setHubSummary] = useState(() => createEmptyHubSummary());
  const [hubLoading, setHubLoading] = useState(false);
  const [hubError, setHubError] = useState('');

  // ========== 常量 ==========
  const now = new Date();
  const isAdminUser = isAdmin();

  // ========== Panel enable flags ==========
  const apiInfoEnabled = statusState?.status?.api_info_enabled ?? true;
  const announcementsEnabled =
    statusState?.status?.announcements_enabled ?? true;
  const faqEnabled = statusState?.status?.faq_enabled ?? true;
  const uptimeEnabled = statusState?.status?.uptime_kuma_enabled ?? true;
  const hubConfigured = statusState?.status?.hub_status?.configured ?? false;
  const hubReachable = statusState?.status?.hub_status?.reachable ?? false;

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
    const timeDiff =
      (Date.parse(end_timestamp) - Date.parse(start_timestamp)) / 60000;
    const avgRPM = isNaN(times / timeDiff)
      ? '0'
      : (times / timeDiff).toFixed(3);
    const avgTPM = isNaN(consumeTokens / timeDiff)
      ? '0'
      : (consumeTokens / timeDiff).toFixed(3);
    const totalPromptTokens = quotaData.reduce(
      (sum, item) => sum + Number(item.prompt_token_used || 0),
      0,
    );
    const totalCachedTokens = quotaData.reduce(
      (sum, item) => sum + Number(item.cached_token_used || 0),
      0,
    );
    const cacheHitRate =
      totalPromptTokens > 0
        ? `${((totalCachedTokens / totalPromptTokens) * 100).toFixed(2)}%`
        : '0.00%';

    return {
      avgRPM,
      avgTPM,
      timeDiff,
      totalPromptTokens,
      totalCachedTokens,
      cacheHitRate,
    };
  }, [
    times,
    consumeTokens,
    quotaData,
    inputs.start_timestamp,
    inputs.end_timestamp,
  ]);

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

  const showSearchModal = useCallback(() => {
    setSearchModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSearchModalVisible(false);
  }, []);

  // ========== API 调用函数 ==========
  const loadQuotaData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '';
      const { start_timestamp, end_timestamp, username } = inputs;
      let localStartTimestamp = Date.parse(start_timestamp) / 1000;
      let localEndTimestamp = Date.parse(end_timestamp) / 1000;

      if (isAdminUser) {
        url = `/api/data/?username=${username}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;
      } else {
        url = `/api/data/self/?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;
      }

      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        setQuotaData(data);
        if (data.length === 0) {
          data.push({
            count: 0,
            model_name: '无数据',
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
    } finally {
      setLoading(false);
    }
  }, [inputs, dataExportDefaultTime, isAdminUser, now]);

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

  const loadHubData = useCallback(async () => {
    if (!hubConfigured || !hubReachable) {
      setHubNodes([]);
      setHubSchedules([]);
      setHubTasks([]);
      setHubAlerts([]);
      setHubSummary(createEmptyHubSummary());
      setHubError('');
      return;
    }

    setHubLoading(true);
    try {
      const summaryRes = await API.get('/hub/api/dashboard/summary', {
        skipErrorHandler: true,
      });

      if (summaryRes.data?.success) {
        setHubSummary({
          onlineNodes: Number(summaryRes.data?.data?.online_nodes || 0),
          busyNodes: Number(summaryRes.data?.data?.busy_nodes || 0),
          pendingTasks: Number(summaryRes.data?.data?.pending_tasks || 0),
          activeSchedules: Number(summaryRes.data?.data?.active_schedules || 0),
          criticalAlerts: Number(summaryRes.data?.data?.critical_alerts || 0),
          unacknowledgedAlerts: Number(
            summaryRes.data?.data?.unacknowledged_alerts || 0,
          ),
          ai: {
            modelCount: Number(summaryRes.data?.data?.ai?.model_count || 0),
            aiCapableNodes: Number(
              summaryRes.data?.data?.ai?.ai_capable_nodes || 0,
            ),
            onlineAINodes: Number(
              summaryRes.data?.data?.ai?.online_ai_nodes || 0,
            ),
          },
          network: {
            mihomoConfigured: Boolean(
              summaryRes.data?.data?.network?.mihomo_configured,
            ),
            mihomoReachable: Boolean(
              summaryRes.data?.data?.network?.mihomo_reachable,
            ),
            dnsConfigured: Boolean(
              summaryRes.data?.data?.network?.dns_configured,
            ),
            dnsReachable: Boolean(
              summaryRes.data?.data?.network?.dns_reachable,
            ),
            dnsProtectionEnabled: Boolean(
              summaryRes.data?.data?.network?.dns_protection_enabled,
            ),
            egressIP: summaryRes.data?.data?.network?.egress_ip || '',
            egressRegion:
              summaryRes.data?.data?.network?.egress_region || '',
            egressISP: summaryRes.data?.data?.network?.egress_isp || '',
            egressSource:
              summaryRes.data?.data?.network?.egress_source || '',
          },
          homeAssistant: {
            configured: Boolean(
              summaryRes.data?.data?.home_assistant?.configured,
            ),
            reachable: Boolean(
              summaryRes.data?.data?.home_assistant?.reachable,
            ),
            entityCount: Number(
              summaryRes.data?.data?.home_assistant?.entity_count || 0,
            ),
          },
          primaryNode: {
            nodeID: summaryRes.data?.data?.primary_node?.node_id || '',
            hostname: summaryRes.data?.data?.primary_node?.hostname || '',
            status: summaryRes.data?.data?.primary_node?.status || '',
            ipAddress: summaryRes.data?.data?.primary_node?.ip_address || '',
          },
        });
        setHubNodes(
          Array.isArray(summaryRes.data?.data?.nodes)
            ? summaryRes.data.data.nodes
            : [],
        );
        setHubSchedules(
          Array.isArray(summaryRes.data?.data?.schedules)
            ? summaryRes.data.data.schedules
            : [],
        );
        setHubTasks(
          Array.isArray(summaryRes.data?.data?.tasks)
            ? summaryRes.data.data.tasks
            : [],
        );
        setHubAlerts(
          Array.isArray(summaryRes.data?.data?.alerts)
            ? summaryRes.data.data.alerts
            : [],
        );
      } else {
        setHubSummary(createEmptyHubSummary());
        setHubNodes([]);
        setHubSchedules([]);
        setHubTasks([]);
        setHubAlerts([]);
      }

      setHubError('');
    } catch (error) {
      console.error('加载家域中枢摘要失败', error);
      setHubSummary(createEmptyHubSummary());
      setHubNodes([]);
      setHubSchedules([]);
      setHubTasks([]);
      setHubAlerts([]);
      setHubError(t('家域中枢摘要加载失败，请稍后重试'));
    } finally {
      setHubLoading(false);
    }
  }, [hubConfigured, hubReachable, t]);

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
    await Promise.all([loadUptimeData(), loadHubData()]);
    return data;
  }, [loadQuotaData, loadUptimeData, loadHubData]);

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
    hubNodes,
    hubSchedules,
    hubTasks,
    hubAlerts,
    hubSummary,
    hubLoading,
    hubError,

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
    loadUptimeData,
    loadHubData,
    getUserData,
    refresh,
    handleSearchConfirm,

    // 导航和翻译
    navigate,
    t,
    isMobile,
  };
};
