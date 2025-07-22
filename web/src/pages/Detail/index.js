import React, { useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import { useNavigate } from 'react-router-dom';
import { Wallet, Activity, Zap, Gauge, PieChart, Server, Bell, HelpCircle, ExternalLink } from 'lucide-react';
import { marked } from 'marked';

import {
  Card,
  Form,
  Spin,
  Button,
  Modal,
  Avatar,
  Tabs,
  TabPane,
  Empty,
  Tag,
  Timeline,
  Collapse,
  Progress,
  Divider,
  Skeleton
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconSearch,
  IconMoneyExchangeStroked,
  IconHistogram,
  IconCoinMoneyStroked,
  IconTextStroked,
  IconPulse,
  IconStopwatchStroked,
  IconTypograph,
  IconPieChart2Stroked,
  IconPlus,
  IconMinus,
  IconSend
} from '@douyinfe/semi-icons';
import { IllustrationConstruction, IllustrationConstructionDark } from '@douyinfe/semi-illustrations';
import { VChart } from '@visactor/react-vchart';
import {
  API,
  isAdmin,
  showError,
  showSuccess,
  showWarning,
  timestamp2string,
  timestamp2string1,
  getQuotaWithUnit,
  modelColorMap,
  renderNumber,
  renderQuota,
  modelToColor,
  copy,
  getRelativeTime
} from '../../helpers';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { UserContext } from '../../context/User/index.js';
import { StatusContext } from '../../context/Status/index.js';
import { useTranslation } from 'react-i18next';

const Detail = (props) => {
  // ========== Hooks - Context ==========
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState, statusDispatch] = useContext(StatusContext);

  // ========== Hooks - Navigation & Translation ==========
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ========== Hooks - Refs ==========
  const formRef = useRef();
  const initialized = useRef(false);
  const apiScrollRef = useRef(null);

  // ========== Constants & Shared Configurations ==========
  const CHART_CONFIG = { mode: 'desktop-browser' };

  const CARD_PROPS = {
    shadows: 'always',
    bordered: false,
    headerLine: true
  };

  const FORM_FIELD_PROPS = {
    className: "w-full mb-2 !rounded-lg",
    size: 'large'
  };

  const ICON_BUTTON_CLASS = "text-white hover:bg-opacity-80 !rounded-full";
  const FLEX_CENTER_GAP2 = "flex items-center gap-2";

  const ILLUSTRATION_SIZE = { width: 96, height: 96 };

  // ========== Constants ==========
  let now = new Date();
  const isAdminUser = isAdmin();

  // ========== Panel enable flags ==========
  const apiInfoEnabled = statusState?.status?.api_info_enabled ?? true;
  const announcementsEnabled = statusState?.status?.announcements_enabled ?? true;
  const faqEnabled = statusState?.status?.faq_enabled ?? true;
  const uptimeEnabled = statusState?.status?.uptime_kuma_enabled ?? true;

  const hasApiInfoPanel = apiInfoEnabled;
  const hasInfoPanels = announcementsEnabled || faqEnabled || uptimeEnabled;

  // ========== Helper Functions ==========
  const getDefaultTime = useCallback(() => {
    return localStorage.getItem('data_export_default_time') || 'hour';
  }, []);

  const getTimeInterval = useCallback((timeType, isSeconds = false) => {
    const intervals = {
      hour: isSeconds ? 3600 : 60,
      day: isSeconds ? 86400 : 1440,
      week: isSeconds ? 604800 : 10080
    };
    return intervals[timeType] || intervals.hour;
  }, []);

  const getInitialTimestamp = useCallback(() => {
    const defaultTime = getDefaultTime();
    const now = new Date().getTime() / 1000;

    switch (defaultTime) {
      case 'hour':
        return timestamp2string(now - 86400);
      case 'week':
        return timestamp2string(now - 86400 * 30);
      default:
        return timestamp2string(now - 86400 * 7);
    }
  }, [getDefaultTime]);

  const updateMapValue = useCallback((map, key, value) => {
    if (!map.has(key)) {
      map.set(key, 0);
    }
    map.set(key, map.get(key) + value);
  }, []);

  const initializeMaps = useCallback((key, ...maps) => {
    maps.forEach(map => {
      if (!map.has(key)) {
        map.set(key, 0);
      }
    });
  }, []);

  const updateChartSpec = useCallback((setterFunc, newData, subtitle, newColors, dataId) => {
    setterFunc(prev => ({
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
  }, []);

  const createSectionTitle = useCallback((Icon, text) => (
    <div className={FLEX_CENTER_GAP2}>
      <Icon size={16} />
      {text}
    </div>
  ), []);

  const createFormField = useCallback((Component, props) => (
    <Component {...FORM_FIELD_PROPS} {...props} />
  ), []);

  // ========== Time Options ==========
  const timeOptions = useMemo(() => [
    { label: t('小时'), value: 'hour' },
    { label: t('天'), value: 'day' },
    { label: t('周'), value: 'week' },
  ], [t]);

  // ========== Hooks - State ==========
  const [inputs, setInputs] = useState({
    username: '',
    token_name: '',
    model_name: '',
    start_timestamp: getInitialTimestamp(),
    end_timestamp: timestamp2string(now.getTime() / 1000 + 3600),
    channel: '',
    data_export_default_time: '',
  });

  const [dataExportDefaultTime, setDataExportDefaultTime] = useState(getDefaultTime());

  const [loading, setLoading] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [quotaData, setQuotaData] = useState([]);
  const [consumeQuota, setConsumeQuota] = useState(0);
  const [consumeTokens, setConsumeTokens] = useState(0);
  const [times, setTimes] = useState(0);
  const [pieData, setPieData] = useState([{ type: 'null', value: '0' }]);
  const [lineData, setLineData] = useState([]);

  const [modelColors, setModelColors] = useState({});
  const [activeChartTab, setActiveChartTab] = useState('1');
  const [showApiScrollHint, setShowApiScrollHint] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const [trendData, setTrendData] = useState({
    balance: [],
    usedQuota: [],
    requestCount: [],
    times: [],
    consumeQuota: [],
    tokens: [],
    rpm: [],
    tpm: []
  });

  // ========== Additional Refs for new cards ==========
  const announcementScrollRef = useRef(null);
  const faqScrollRef = useRef(null);
  const uptimeScrollRef = useRef(null);
  const uptimeTabScrollRefs = useRef({});

  // ========== Additional State for scroll hints ==========
  const [showAnnouncementScrollHint, setShowAnnouncementScrollHint] = useState(false);
  const [showFaqScrollHint, setShowFaqScrollHint] = useState(false);
  const [showUptimeScrollHint, setShowUptimeScrollHint] = useState(false);

  // ========== Uptime data ==========
  const [uptimeData, setUptimeData] = useState([]);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [activeUptimeTab, setActiveUptimeTab] = useState('');

  // ========== Props Destructuring ==========
  const { username, model_name, start_timestamp, end_timestamp, channel } = inputs;

  // ========== Chart Specs State ==========
  const [spec_pie, setSpecPie] = useState({
    type: 'pie',
    data: [
      {
        id: 'id0',
        values: pieData,
      },
    ],
    outerRadius: 0.8,
    innerRadius: 0.5,
    padAngle: 0.6,
    valueField: 'value',
    categoryField: 'type',
    pie: {
      style: {
        cornerRadius: 10,
      },
      state: {
        hover: {
          outerRadius: 0.85,
          stroke: '#000',
          lineWidth: 1,
        },
        selected: {
          outerRadius: 0.85,
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
    title: {
      visible: true,
      text: t('模型调用次数占比'),
      subtext: `${t('总计')}：${renderNumber(times)}`,
    },
    legends: {
      visible: true,
      orient: 'left',
    },
    label: {
      visible: true,
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datum['type'],
            value: (datum) => renderNumber(datum['value']),
          },
        ],
      },
    },
    color: {
      specified: modelColorMap,
    },
  });

  const [spec_line, setSpecLine] = useState({
    type: 'bar',
    data: [
      {
        id: 'barData',
        values: lineData,
      },
    ],
    xField: 'Time',
    yField: 'Usage',
    seriesField: 'Model',
    stack: true,
    legends: {
      visible: true,
      selectMode: 'single',
    },
    title: {
      visible: true,
      text: t('模型消耗分布'),
      subtext: `${t('总计')}：${renderQuota(consumeQuota, 2)}`,
    },
    bar: {
      state: {
        hover: {
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datum['Model'],
            value: (datum) => renderQuota(datum['rawQuota'] || 0, 4),
          },
        ],
      },
      dimension: {
        content: [
          {
            key: (datum) => datum['Model'],
            value: (datum) => datum['rawQuota'] || 0,
          },
        ],
        updateContent: (array) => {
          array.sort((a, b) => b.value - a.value);
          let sum = 0;
          for (let i = 0; i < array.length; i++) {
            if (array[i].key == '其他') {
              continue;
            }
            let value = parseFloat(array[i].value);
            if (isNaN(value)) {
              value = 0;
            }
            if (array[i].datum && array[i].datum.TimeSum) {
              sum = array[i].datum.TimeSum;
            }
            array[i].value = renderQuota(value, 4);
          }
          array.unshift({
            key: t('总计'),
            value: renderQuota(sum, 4),
          });
          return array;
        },
      },
    },
    color: {
      specified: modelColorMap,
    },
  });

  // 模型消耗趋势折线图
  const [spec_model_line, setSpecModelLine] = useState({
    type: 'line',
    data: [
      {
        id: 'lineData',
        values: [],
      },
    ],
    xField: 'Time',
    yField: 'Count',
    seriesField: 'Model',
    legends: {
      visible: true,
      selectMode: 'single',
    },
    title: {
      visible: true,
      text: t('模型消耗趋势'),
      subtext: '',
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datum['Model'],
            value: (datum) => renderNumber(datum['Count']),
          },
        ],
      },
    },
    color: {
      specified: modelColorMap,
    },
  });

  // 模型调用次数排行柱状图
  const [spec_rank_bar, setSpecRankBar] = useState({
    type: 'bar',
    data: [
      {
        id: 'rankData',
        values: [],
      },
    ],
    xField: 'Model',
    yField: 'Count',
    seriesField: 'Model',
    legends: {
      visible: true,
      selectMode: 'single',
    },
    title: {
      visible: true,
      text: t('模型调用次数排行'),
      subtext: '',
    },
    bar: {
      state: {
        hover: {
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datum['Model'],
            value: (datum) => renderNumber(datum['Count']),
          },
        ],
      },
    },
    color: {
      specified: modelColorMap,
    },
  });

  // ========== Hooks - Memoized Values ==========
  const performanceMetrics = useMemo(() => {
    const timeDiff = (Date.parse(end_timestamp) - Date.parse(start_timestamp)) / 60000;
    const avgRPM = isNaN(times / timeDiff) ? '0' : (times / timeDiff).toFixed(3);
    const avgTPM = isNaN(consumeTokens / timeDiff) ? '0' : (consumeTokens / timeDiff).toFixed(3);

    return { avgRPM, avgTPM, timeDiff };
  }, [times, consumeTokens, end_timestamp, start_timestamp]);

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

  // ========== Hooks - Callbacks ==========
  const getTrendSpec = useCallback((data, color) => ({
    type: 'line',
    data: [{ id: 'trend', values: data.map((val, idx) => ({ x: idx, y: val })) }],
    xField: 'x',
    yField: 'y',
    height: 40,
    width: 100,
    axes: [
      {
        orient: 'bottom',
        visible: false
      },
      {
        orient: 'left',
        visible: false
      }
    ],
    padding: 0,
    autoFit: false,
    legends: { visible: false },
    tooltip: { visible: false },
    crosshair: { visible: false },
    line: {
      style: {
        stroke: color,
        lineWidth: 2
      }
    },
    point: {
      visible: false
    },
    background: {
      fill: 'transparent'
    }
  }), []);

  const groupedStatsData = useMemo(() => [
    {
      title: createSectionTitle(Wallet, t('账户数据')),
      color: 'bg-blue-50',
      items: [
        {
          title: t('当前余额'),
          value: renderQuota(userState?.user?.quota),
          icon: <IconMoneyExchangeStroked />,
          avatarColor: 'blue',
          onClick: () => navigate('/console/topup'),
          trendData: [],
          trendColor: '#3b82f6'
        },
        {
          title: t('历史消耗'),
          value: renderQuota(userState?.user?.used_quota),
          icon: <IconHistogram />,
          avatarColor: 'purple',
          trendData: [],
          trendColor: '#8b5cf6'
        }
      ]
    },
    {
      title: createSectionTitle(Activity, t('使用统计')),
      color: 'bg-green-50',
      items: [
        {
          title: t('请求次数'),
          value: userState.user?.request_count,
          icon: <IconSend />,
          avatarColor: 'green',
          trendData: [],
          trendColor: '#10b981'
        },
        {
          title: t('统计次数'),
          value: times,
          icon: <IconPulse />,
          avatarColor: 'cyan',
          trendData: trendData.times,
          trendColor: '#06b6d4'
        }
      ]
    },
    {
      title: createSectionTitle(Zap, t('资源消耗')),
      color: 'bg-yellow-50',
      items: [
        {
          title: t('统计额度'),
          value: renderQuota(consumeQuota),
          icon: <IconCoinMoneyStroked />,
          avatarColor: 'yellow',
          trendData: trendData.consumeQuota,
          trendColor: '#f59e0b'
        },
        {
          title: t('统计Tokens'),
          value: isNaN(consumeTokens) ? 0 : consumeTokens,
          icon: <IconTextStroked />,
          avatarColor: 'pink',
          trendData: trendData.tokens,
          trendColor: '#ec4899'
        }
      ]
    },
    {
      title: createSectionTitle(Gauge, t('性能指标')),
      color: 'bg-indigo-50',
      items: [
        {
          title: t('平均RPM'),
          value: performanceMetrics.avgRPM,
          icon: <IconStopwatchStroked />,
          avatarColor: 'indigo',
          trendData: trendData.rpm,
          trendColor: '#6366f1'
        },
        {
          title: t('平均TPM'),
          value: performanceMetrics.avgTPM,
          icon: <IconTypograph />,
          avatarColor: 'orange',
          trendData: trendData.tpm,
          trendColor: '#f97316'
        }
      ]
    }
  ], [
    createSectionTitle, t, userState?.user?.quota, userState?.user?.used_quota, userState?.user?.request_count,
    times, consumeQuota, consumeTokens, trendData, performanceMetrics, navigate
  ]);

  const handleCopyUrl = useCallback(async (url) => {
    if (await copy(url)) {
      showSuccess(t('复制成功'));
    }
  }, [t]);

  const handleSpeedTest = useCallback((apiUrl) => {
    const encodedUrl = encodeURIComponent(apiUrl);
    const speedTestUrl = `https://www.tcptest.cn/http/${encodedUrl}`;
    window.open(speedTestUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const handleInputChange = useCallback((value, name) => {
    if (name === 'data_export_default_time') {
      setDataExportDefaultTime(value);
      return;
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }, []);

  const loadQuotaData = useCallback(async () => {
    setLoading(true);
    const startTime = Date.now();
    try {
      let url = '';
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
        updateChartData(data);
      } else {
        showError(message);
      }
    } finally {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsed);
      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
    }
  }, [start_timestamp, end_timestamp, username, dataExportDefaultTime, isAdminUser]);

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

  const refresh = useCallback(async () => {
    await Promise.all([loadQuotaData(), loadUptimeData()]);
  }, [loadQuotaData, loadUptimeData]);

  const handleSearchConfirm = useCallback(() => {
    refresh();
    setSearchModalVisible(false);
  }, [refresh]);

  const initChart = useCallback(async () => {
    await loadQuotaData();
    await loadUptimeData();
  }, [loadQuotaData, loadUptimeData]);

  const showSearchModal = useCallback(() => {
    setSearchModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSearchModalVisible(false);
  }, []);

  // ========== Regular Functions ==========
  const checkApiScrollable = () => {
    if (apiScrollRef.current) {
      const element = apiScrollRef.current;
      const isScrollable = element.scrollHeight > element.clientHeight;
      const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 5;
      setShowApiScrollHint(isScrollable && !isAtBottom);
    }
  };

  const handleApiScroll = () => {
    checkApiScrollable();
  };

  const checkCardScrollable = (ref, setHintFunction) => {
    if (ref.current) {
      const element = ref.current;
      const isScrollable = element.scrollHeight > element.clientHeight;
      const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 5;
      setHintFunction(isScrollable && !isAtBottom);
    }
  };

  const handleCardScroll = (ref, setHintFunction) => {
    checkCardScrollable(ref, setHintFunction);
  };

  // ========== Effects for scroll detection ==========
  useEffect(() => {
    const timer = setTimeout(() => {
      checkApiScrollable();
      checkCardScrollable(announcementScrollRef, setShowAnnouncementScrollHint);
      checkCardScrollable(faqScrollRef, setShowFaqScrollHint);

      if (uptimeData.length === 1) {
        checkCardScrollable(uptimeScrollRef, setShowUptimeScrollHint);
      } else if (uptimeData.length > 1 && activeUptimeTab) {
        const activeTabRef = uptimeTabScrollRefs.current[activeUptimeTab];
        if (activeTabRef) {
          checkCardScrollable(activeTabRef, setShowUptimeScrollHint);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [uptimeData, activeUptimeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGreetingVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const getUserData = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  // ========== Data Processing Functions ==========
  const processRawData = useCallback((data) => {
    const result = {
      totalQuota: 0,
      totalTimes: 0,
      totalTokens: 0,
      uniqueModels: new Set(),
      timePoints: [],
      timeQuotaMap: new Map(),
      timeTokensMap: new Map(),
      timeCountMap: new Map()
    };

    data.forEach((item) => {
      result.uniqueModels.add(item.model_name);
      result.totalTokens += item.token_used;
      result.totalQuota += item.quota;
      result.totalTimes += item.count;

      const timeKey = timestamp2string1(item.created_at, dataExportDefaultTime);
      if (!result.timePoints.includes(timeKey)) {
        result.timePoints.push(timeKey);
      }

      initializeMaps(timeKey, result.timeQuotaMap, result.timeTokensMap, result.timeCountMap);
      updateMapValue(result.timeQuotaMap, timeKey, item.quota);
      updateMapValue(result.timeTokensMap, timeKey, item.token_used);
      updateMapValue(result.timeCountMap, timeKey, item.count);
    });

    result.timePoints.sort();
    return result;
  }, [dataExportDefaultTime, initializeMaps, updateMapValue]);

  const calculateTrendData = useCallback((timePoints, timeQuotaMap, timeTokensMap, timeCountMap) => {
    const quotaTrend = timePoints.map(time => timeQuotaMap.get(time) || 0);
    const tokensTrend = timePoints.map(time => timeTokensMap.get(time) || 0);
    const countTrend = timePoints.map(time => timeCountMap.get(time) || 0);

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
      tpm: tpmTrend
    };
  }, [dataExportDefaultTime, getTimeInterval]);

  const generateModelColors = useCallback((uniqueModels) => {
    const newModelColors = {};
    Array.from(uniqueModels).forEach((modelName) => {
      newModelColors[modelName] =
        modelColorMap[modelName] ||
        modelColors[modelName] ||
        modelToColor(modelName);
    });
    return newModelColors;
  }, [modelColors]);

  const aggregateDataByTimeAndModel = useCallback((data) => {
    const aggregatedData = new Map();

    data.forEach((item) => {
      const timeKey = timestamp2string1(item.created_at, dataExportDefaultTime);
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
  }, [dataExportDefaultTime]);

  const generateChartTimePoints = useCallback((aggregatedData, data) => {
    let chartTimePoints = Array.from(
      new Set([...aggregatedData.values()].map((d) => d.time)),
    );

    if (chartTimePoints.length < 7) {
      const lastTime = Math.max(...data.map((item) => item.created_at));
      const interval = getTimeInterval(dataExportDefaultTime, true);

      chartTimePoints = Array.from({ length: 7 }, (_, i) =>
        timestamp2string1(lastTime - (6 - i) * interval, dataExportDefaultTime),
      );
    }

    return chartTimePoints;
  }, [dataExportDefaultTime, getTimeInterval]);

  const updateChartData = useCallback((data) => {
    const processedData = processRawData(data);
    const { totalQuota, totalTimes, totalTokens, uniqueModels, timePoints, timeQuotaMap, timeTokensMap, timeCountMap } = processedData;

    const trendDataResult = calculateTrendData(timePoints, timeQuotaMap, timeTokensMap, timeCountMap);
    setTrendData(trendDataResult);

    const newModelColors = generateModelColors(uniqueModels);
    setModelColors(newModelColors);

    const aggregatedData = aggregateDataByTimeAndModel(data);

    const modelTotals = new Map();
    for (let [_, value] of aggregatedData) {
      updateMapValue(modelTotals, value.model, value.count);
    }

    const newPieData = Array.from(modelTotals).map(([model, count]) => ({
      type: model,
      value: count,
    })).sort((a, b) => b.value - a.value);

    const chartTimePoints = generateChartTimePoints(aggregatedData, data);
    let newLineData = [];

    chartTimePoints.forEach((time) => {
      let timeData = Array.from(uniqueModels).map((model) => {
        const key = `${time}-${model}`;
        const aggregated = aggregatedData.get(key);
        return {
          Time: time,
          Model: model,
          rawQuota: aggregated?.quota || 0,
          Usage: aggregated?.quota ? getQuotaWithUnit(aggregated.quota, 4) : 0,
        };
      });

      const timeSum = timeData.reduce((sum, item) => sum + item.rawQuota, 0);
      timeData.sort((a, b) => b.rawQuota - a.rawQuota);
      timeData = timeData.map((item) => ({ ...item, TimeSum: timeSum }));
      newLineData.push(...timeData);
    });

    newLineData.sort((a, b) => a.Time.localeCompare(b.Time));

    updateChartSpec(
      setSpecPie,
      newPieData,
      `${t('总计')}：${renderNumber(totalTimes)}`,
      newModelColors,
      'id0'
    );

    updateChartSpec(
      setSpecLine,
      newLineData,
      `${t('总计')}：${renderQuota(totalQuota, 2)}`,
      newModelColors,
      'barData'
    );

    // ===== 模型调用次数折线图 =====
    let modelLineData = [];
    chartTimePoints.forEach((time) => {
      const timeData = Array.from(uniqueModels).map((model) => {
        const key = `${time}-${model}`;
        const aggregated = aggregatedData.get(key);
        return {
          Time: time,
          Model: model,
          Count: aggregated?.count || 0,
        };
      });
      modelLineData.push(...timeData);
    });
    modelLineData.sort((a, b) => a.Time.localeCompare(b.Time));

    // ===== 模型调用次数排行柱状图 =====
    const rankData = Array.from(modelTotals)
      .map(([model, count]) => ({
        Model: model,
        Count: count,
      }))
      .sort((a, b) => b.Count - a.Count);

    updateChartSpec(
      setSpecModelLine,
      modelLineData,
      `${t('总计')}：${renderNumber(totalTimes)}`,
      newModelColors,
      'lineData'
    );

    updateChartSpec(
      setSpecRankBar,
      rankData,
      `${t('总计')}：${renderNumber(totalTimes)}`,
      newModelColors,
      'rankData'
    );

    setPieData(newPieData);
    setLineData(newLineData);
    setConsumeQuota(totalQuota);
    setTimes(totalTimes);
    setConsumeTokens(totalTokens);
  }, [
    processRawData, calculateTrendData, generateModelColors, aggregateDataByTimeAndModel,
    generateChartTimePoints, updateChartSpec, updateMapValue, t
  ]);

  // ========== Status Data Management ==========
  const announcementLegendData = useMemo(() => [
    { color: 'grey', label: t('默认'), type: 'default' },
    { color: 'blue', label: t('进行中'), type: 'ongoing' },
    { color: 'green', label: t('成功'), type: 'success' },
    { color: 'orange', label: t('警告'), type: 'warning' },
    { color: 'red', label: t('异常'), type: 'error' }
  ], [t]);

  const uptimeStatusMap = useMemo(() => ({
    1: { color: '#10b981', label: t('正常'), text: t('可用率') },   // UP
    0: { color: '#ef4444', label: t('异常'), text: t('有异常') },   // DOWN
    2: { color: '#f59e0b', label: t('高延迟'), text: t('高延迟') }, // PENDING
    3: { color: '#3b82f6', label: t('维护中'), text: t('维护中') }   // MAINTENANCE
  }), [t]);

  const uptimeLegendData = useMemo(() =>
    Object.entries(uptimeStatusMap).map(([status, info]) => ({
      status: Number(status),
      color: info.color,
      label: info.label
    })), [uptimeStatusMap]);

  const getUptimeStatusColor = useCallback((status) =>
    uptimeStatusMap[status]?.color || '#8b9aa7',
    [uptimeStatusMap]);

  const getUptimeStatusText = useCallback((status) =>
    uptimeStatusMap[status]?.text || t('未知'),
    [uptimeStatusMap, t]);

  const apiInfoData = useMemo(() => {
    return statusState?.status?.api_info || [];
  }, [statusState?.status?.api_info]);

  const announcementData = useMemo(() => {
    const announcements = statusState?.status?.announcements || [];
    return announcements.map(item => ({
      ...item,
      time: getRelativeTime(item.publishDate)
    }));
  }, [statusState?.status?.announcements]);

  const faqData = useMemo(() => {
    return statusState?.status?.faq || [];
  }, [statusState?.status?.faq]);

  const renderMonitorList = useCallback((monitors) => {
    if (!monitors || monitors.length === 0) {
      return (
        <div className="flex justify-center items-center py-4">
          <Empty
            image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
            darkModeImage={<IllustrationConstructionDark style={ILLUSTRATION_SIZE} />}
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
      <div key={idx} className="p-2 hover:bg-white rounded-lg transition-colors">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getUptimeStatusColor(monitor.status) }}
            />
            <span className="text-sm font-medium text-gray-900">{monitor.name}</span>
          </div>
          <span className="text-xs text-gray-500">{((monitor.uptime || 0) * 100).toFixed(2)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{getUptimeStatusText(monitor.status)}</span>
          <div className="flex-1">
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
      <div key={gname || 'default'} className="mb-2">
        {gname && (
          <>
            <div className="text-md font-semibold text-gray-500 px-2 py-1">
              {gname}
            </div>
            <Divider />
          </>
        )}
        {list.map(renderItem)}
      </div>
    ));
  }, [t, getUptimeStatusColor, getUptimeStatusText]);

  // ========== Hooks - Effects ==========
  useEffect(() => {
    getUserData();
    if (!initialized.current) {
      initVChartSemiTheme({
        isWatchingThemeSwitch: true,
      });
      initialized.current = true;
      initChart();
    }
  }, []);

  return (
    <div className="bg-gray-50 h-full mt-[64px] px-2">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-2xl font-semibold text-gray-800 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: greetingVisible ? 1 : 0 }}
        >
          {getGreeting}
        </h2>
        <div className="flex gap-3">
          <Button
            type='tertiary'
            icon={<IconSearch />}
            onClick={showSearchModal}
            className={`bg-green-500 hover:bg-green-600 ${ICON_BUTTON_CLASS}`}
          />
          <Button
            type='tertiary'
            icon={<IconRefresh />}
            onClick={refresh}
            loading={loading}
            className={`bg-blue-500 hover:bg-blue-600 ${ICON_BUTTON_CLASS}`}
          />
        </div>
      </div>

      {/* 搜索条件Modal */}
      <Modal
        title={t('搜索条件')}
        visible={searchModalVisible}
        onOk={handleSearchConfirm}
        onCancel={handleCloseModal}
        closeOnEsc={true}
        size={isMobile ? 'full-width' : 'small'}
        centered
      >
        <Form ref={formRef} layout='vertical' className="w-full">
          {createFormField(Form.DatePicker, {
            field: 'start_timestamp',
            label: t('起始时间'),
            initValue: start_timestamp,
            value: start_timestamp,
            type: 'dateTime',
            name: 'start_timestamp',
            onChange: (value) => handleInputChange(value, 'start_timestamp')
          })}

          {createFormField(Form.DatePicker, {
            field: 'end_timestamp',
            label: t('结束时间'),
            initValue: end_timestamp,
            value: end_timestamp,
            type: 'dateTime',
            name: 'end_timestamp',
            onChange: (value) => handleInputChange(value, 'end_timestamp')
          })}

          {createFormField(Form.Select, {
            field: 'data_export_default_time',
            label: t('时间粒度'),
            initValue: dataExportDefaultTime,
            placeholder: t('时间粒度'),
            name: 'data_export_default_time',
            optionList: timeOptions,
            onChange: (value) => handleInputChange(value, 'data_export_default_time')
          })}

          {isAdminUser && createFormField(Form.Input, {
            field: 'username',
            label: t('用户名称'),
            value: username,
            placeholder: t('可选值'),
            name: 'username',
            onChange: (value) => handleInputChange(value, 'username')
          })}
        </Form>
      </Modal>

      <div className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {groupedStatsData.map((group, idx) => (
            <Card
              key={idx}
              {...CARD_PROPS}
              className={`${group.color} border-0 !rounded-2xl w-full`}
              title={group.title}
            >
              <div className="space-y-4">
                {group.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex items-center justify-between cursor-pointer"
                    onClick={item.onClick}
                  >
                    <div className="flex items-center">
                      <Avatar
                        className="mr-3"
                        size="small"
                        color={item.avatarColor}
                      >
                        {item.icon}
                      </Avatar>
                      <div>
                        <div className="text-xs text-gray-500">{item.title}</div>
                        <div className="text-lg font-semibold">
                          <Skeleton
                            loading={loading}
                            active
                            placeholder={
                              <Skeleton.Paragraph
                                active
                                rows={1}
                                style={{ width: '65px', height: '24px', marginTop: '4px' }}
                              />
                            }
                          >
                            {item.value}
                          </Skeleton>
                        </div>
                      </div>
                    </div>
                    {(loading || (item.trendData && item.trendData.length > 0)) && (
                      <div className="w-24 h-10">
                        <VChart
                          spec={getTrendSpec(item.trendData, item.trendColor)}
                          option={CHART_CONFIG}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className={`grid grid-cols-1 gap-4 ${hasApiInfoPanel ? 'lg:grid-cols-4' : ''}`}>
          <Card
            {...CARD_PROPS}
            className={`shadow-sm !rounded-2xl ${hasApiInfoPanel ? 'lg:col-span-3' : ''}`}
            title={
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-3">
                <div className={FLEX_CENTER_GAP2}>
                  <PieChart size={16} />
                  {t('模型数据分析')}
                </div>
                <Tabs
                  type="button"
                  activeKey={activeChartTab}
                  onChange={setActiveChartTab}
                >
                  <TabPane tab={
                    <span>
                      <IconHistogram />
                      {t('消耗分布')}
                    </span>
                  } itemKey="1" />
                  <TabPane tab={
                    <span>
                      <IconPulse />
                      {t('消耗趋势')}
                    </span>
                  } itemKey="2" />
                  <TabPane tab={
                    <span>
                      <IconPieChart2Stroked />
                      {t('调用次数分布')}
                    </span>
                  } itemKey="3" />
                  <TabPane tab={
                    <span>
                      <IconHistogram />
                      {t('调用次数排行')}
                    </span>
                  } itemKey="4" />
                </Tabs>
              </div>
            }
            bodyStyle={{ padding: 0 }}
          >
            <div className="h-96 p-2">
              {activeChartTab === '1' && (
                <VChart
                  spec={spec_line}
                  option={CHART_CONFIG}
                />
              )}
              {activeChartTab === '2' && (
                <VChart
                  spec={spec_model_line}
                  option={CHART_CONFIG}
                />
              )}
              {activeChartTab === '3' && (
                <VChart
                  spec={spec_pie}
                  option={CHART_CONFIG}
                />
              )}
              {activeChartTab === '4' && (
                <VChart
                  spec={spec_rank_bar}
                  option={CHART_CONFIG}
                />
              )}
            </div>
          </Card>

          {hasApiInfoPanel && (
            <Card
              {...CARD_PROPS}
              className="bg-gray-50 border-0 !rounded-2xl"
              title={
                <div className={FLEX_CENTER_GAP2}>
                  <Server size={16} />
                  {t('API信息')}
                </div>
              }
              bodyStyle={{ padding: 0 }}
            >
              <div className="card-content-container">
                <div
                  ref={apiScrollRef}
                  className="p-2 max-h-96 overflow-y-auto card-content-scroll"
                  onScroll={handleApiScroll}
                >
                  {apiInfoData.length > 0 ? (
                    apiInfoData.map((api) => (
                      <>
                        <div key={api.id} className="flex p-2 hover:bg-white rounded-lg transition-colors cursor-pointer">
                          <div className="flex-shrink-0 mr-3">
                            <Avatar
                              size="extra-small"
                              color={api.color}
                            >
                              {api.route.substring(0, 2)}
                            </Avatar>
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between mb-1 w-full gap-2">
                              <span className="text-sm font-medium text-gray-900 !font-bold break-all">
                                {api.route}
                              </span>
                              <div className="flex items-center gap-1 mt-1 lg:mt-0">
                                <Tag
                                  prefixIcon={<Gauge size={12} />}
                                  size="small"
                                  color="white"
                                  shape='circle'
                                  onClick={() => handleSpeedTest(api.url)}
                                  className="cursor-pointer hover:opacity-80 text-xs"
                                >
                                  {t('测速')}
                                </Tag>
                                <Tag
                                  prefixIcon={<ExternalLink size={12} />}
                                  size="small"
                                  color="white"
                                  shape='circle'
                                  onClick={() => window.open(api.url, '_blank', 'noopener,noreferrer')}
                                  className="cursor-pointer hover:opacity-80 text-xs"
                                >
                                  {t('跳转')}
                                </Tag>
                              </div>
                            </div>
                            <div
                              className="!text-semi-color-primary break-all cursor-pointer hover:underline mb-1"
                              onClick={() => handleCopyUrl(api.url)}
                            >
                              {api.url}
                            </div>
                            <div className="text-gray-500">
                              {api.description}
                            </div>
                          </div>
                        </div>
                        <Divider />
                      </>
                    ))
                  ) : (
                    <div className="flex justify-center items-center py-8">
                      <Empty
                        image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
                        darkModeImage={<IllustrationConstructionDark style={ILLUSTRATION_SIZE} />}
                        title={t('暂无API信息')}
                        description={t('请联系管理员在系统设置中配置API信息')}
                      />
                    </div>
                  )}
                </div>
                <div
                  className="card-content-fade-indicator"
                  style={{ opacity: showApiScrollHint ? 1 : 0 }}
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 系统公告和常见问答卡片 */}
      {
        hasInfoPanels && (
          <div className="mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* 公告卡片 */}
              {announcementsEnabled && (
                <Card
                  {...CARD_PROPS}
                  className="shadow-sm !rounded-2xl lg:col-span-2"
                  title={
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 w-full">
                      <div className="flex items-center gap-2">
                        <Bell size={16} />
                        {t('系统公告')}
                        <Tag color="white" shape="circle">
                          {t('显示最新20条')}
                        </Tag>
                      </div>
                      {/* 图例 */}
                      <div className="flex flex-wrap gap-3 text-xs">
                        {announcementLegendData.map((legend, index) => (
                          <div key={index} className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: legend.color === 'grey' ? '#8b9aa7' :
                                  legend.color === 'blue' ? '#3b82f6' :
                                    legend.color === 'green' ? '#10b981' :
                                      legend.color === 'orange' ? '#f59e0b' :
                                        legend.color === 'red' ? '#ef4444' : '#8b9aa7'
                              }}
                            />
                            <span className="text-gray-600">{legend.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  }
                  bodyStyle={{ padding: 0 }}
                >
                  <div className="card-content-container">
                    <div
                      ref={announcementScrollRef}
                      className="p-2 max-h-96 overflow-y-auto card-content-scroll"
                      onScroll={() => handleCardScroll(announcementScrollRef, setShowAnnouncementScrollHint)}
                    >
                      {announcementData.length > 0 ? (
                        <Timeline mode="alternate">
                          {announcementData.map((item, idx) => (
                            <Timeline.Item
                              key={idx}
                              type={item.type || 'default'}
                              time={item.time}
                            >
                              <div>
                                <div
                                  dangerouslySetInnerHTML={{ __html: marked.parse(item.content || '') }}
                                />
                                {item.extra && (
                                  <div
                                    className="text-xs text-gray-500"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(item.extra) }}
                                  />
                                )}
                              </div>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      ) : (
                        <div className="flex justify-center items-center py-8">
                          <Empty
                            image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
                            darkModeImage={<IllustrationConstructionDark style={ILLUSTRATION_SIZE} />}
                            title={t('暂无系统公告')}
                            description={t('请联系管理员在系统设置中配置公告信息')}
                          />
                        </div>
                      )}
                    </div>
                    <div
                      className="card-content-fade-indicator"
                      style={{ opacity: showAnnouncementScrollHint ? 1 : 0 }}
                    />
                  </div>
                </Card>
              )}

              {/* 常见问答卡片 */}
              {faqEnabled && (
                <Card
                  {...CARD_PROPS}
                  className="shadow-sm !rounded-2xl lg:col-span-1"
                  title={
                    <div className={FLEX_CENTER_GAP2}>
                      <HelpCircle size={16} />
                      {t('常见问答')}
                    </div>
                  }
                  bodyStyle={{ padding: 0 }}
                >
                  <div className="card-content-container">
                    <div
                      ref={faqScrollRef}
                      className="p-2 max-h-96 overflow-y-auto card-content-scroll"
                      onScroll={() => handleCardScroll(faqScrollRef, setShowFaqScrollHint)}
                    >
                      {faqData.length > 0 ? (
                        <Collapse
                          accordion
                          expandIcon={<IconPlus />}
                          collapseIcon={<IconMinus />}
                        >
                          {faqData.map((item, index) => (
                            <Collapse.Panel
                              key={index}
                              header={item.question}
                              itemKey={index.toString()}
                            >
                              <div
                                dangerouslySetInnerHTML={{ __html: marked.parse(item.answer || '') }}
                              />
                            </Collapse.Panel>
                          ))}
                        </Collapse>
                      ) : (
                        <div className="flex justify-center items-center py-8">
                          <Empty
                            image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
                            darkModeImage={<IllustrationConstructionDark style={ILLUSTRATION_SIZE} />}
                            title={t('暂无常见问答')}
                            description={t('请联系管理员在系统设置中配置常见问答')}
                          />
                        </div>
                      )}
                    </div>
                    <div
                      className="card-content-fade-indicator"
                      style={{ opacity: showFaqScrollHint ? 1 : 0 }}
                    />
                  </div>
                </Card>
              )}

              {/* 服务可用性卡片 */}
              {uptimeEnabled && (
                <Card
                  {...CARD_PROPS}
                  className="shadow-sm !rounded-2xl lg:col-span-1"
                  title={
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2">
                        <Gauge size={16} />
                        {t('服务可用性')}
                      </div>
                      <Button
                        icon={<IconRefresh />}
                        onClick={loadUptimeData}
                        loading={uptimeLoading}
                        size="small"
                        theme="borderless"
                        type='tertiary'
                        className="text-gray-500 hover:text-blue-500 hover:bg-blue-50 !rounded-full"
                      />
                    </div>
                  }
                  bodyStyle={{ padding: 0 }}
                >
                  {/* 内容区域 */}
                  <div className="relative">
                    <Spin spinning={uptimeLoading}>
                      {uptimeData.length > 0 ? (
                        uptimeData.length === 1 ? (
                          <div className="card-content-container">
                            <div
                              ref={uptimeScrollRef}
                              className="p-2 max-h-[24rem] overflow-y-auto card-content-scroll"
                              onScroll={() => handleCardScroll(uptimeScrollRef, setShowUptimeScrollHint)}
                            >
                              {renderMonitorList(uptimeData[0].monitors)}
                            </div>
                            <div
                              className="card-content-fade-indicator"
                              style={{ opacity: showUptimeScrollHint ? 1 : 0 }}
                            />
                          </div>
                        ) : (
                          <Tabs
                            type="card"
                            collapsible
                            activeKey={activeUptimeTab}
                            onChange={setActiveUptimeTab}
                            size="small"
                          >
                            {uptimeData.map((group, groupIdx) => {
                              if (!uptimeTabScrollRefs.current[group.categoryName]) {
                                uptimeTabScrollRefs.current[group.categoryName] = React.createRef();
                              }
                              const tabScrollRef = uptimeTabScrollRefs.current[group.categoryName];

                              return (
                                <TabPane
                                  tab={
                                    <span className="flex items-center gap-2">
                                      <Gauge size={14} />
                                      {group.categoryName}
                                      <Tag
                                        color={activeUptimeTab === group.categoryName ? 'red' : 'grey'}
                                        size='small'
                                        shape='circle'
                                      >
                                        {group.monitors ? group.monitors.length : 0}
                                      </Tag>
                                    </span>
                                  }
                                  itemKey={group.categoryName}
                                  key={groupIdx}
                                >
                                  <div className="card-content-container">
                                    <div
                                      ref={tabScrollRef}
                                      className="p-2 max-h-[21.5rem] overflow-y-auto card-content-scroll"
                                      onScroll={() => handleCardScroll(tabScrollRef, setShowUptimeScrollHint)}
                                    >
                                      {renderMonitorList(group.monitors)}
                                    </div>
                                    <div
                                      className="card-content-fade-indicator"
                                      style={{ opacity: activeUptimeTab === group.categoryName ? showUptimeScrollHint ? 1 : 0 : 0 }}
                                    />
                                  </div>
                                </TabPane>
                              );
                            })}
                          </Tabs>
                        )
                      ) : (
                        <div className="flex justify-center items-center py-8">
                          <Empty
                            image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
                            darkModeImage={<IllustrationConstructionDark style={ILLUSTRATION_SIZE} />}
                            title={t('暂无监控数据')}
                            description={t('请联系管理员在系统设置中配置Uptime')}
                          />
                        </div>
                      )}
                    </Spin>
                  </div>

                  {/* 图例 */}
                  {uptimeData.length > 0 && (
                    <div className="p-3 bg-gray-50 rounded-b-2xl">
                      <div className="flex flex-wrap gap-3 text-xs justify-center">
                        {uptimeLegendData.map((legend, index) => (
                          <div key={index} className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: legend.color }}
                            />
                            <span className="text-gray-600">{legend.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Detail;
