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

import { useState, useEffect, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import {
  API,
  copy,
  isAdmin,
  showError,
  showSuccess,
} from '../../helpers';
import { timestamp2string } from '../../helpers/utils';
import { ITEMS_PER_PAGE } from '../../constants/common.constant';
import { useTableCompactMode } from '../common/useTableCompactMode';

const DEFAULT_MEDIA_TYPE = 'all';
const DEFAULT_RANGE_PRESET = 'today';

const TASK_STATS_RANGE_PRESETS = [
  {
    key: 'today',
    label: '今天',
    getRange: () => [dayjs().startOf('day').toDate(), dayjs().endOf('day').toDate()],
  },
  {
    key: 'yesterday',
    label: '昨天',
    getRange: () => [
      dayjs().subtract(1, 'day').startOf('day').toDate(),
      dayjs().subtract(1, 'day').endOf('day').toDate(),
    ],
  },
  {
    key: 'last3',
    label: '近3天',
    getRange: () => [dayjs().subtract(2, 'day').startOf('day').toDate(), dayjs().endOf('day').toDate()],
  },
  {
    key: 'last7',
    label: '近7天',
    getRange: () => [dayjs().subtract(6, 'day').startOf('day').toDate(), dayjs().endOf('day').toDate()],
  },
  {
    key: 'last30',
    label: '近30天',
    getRange: () => [dayjs().subtract(29, 'day').startOf('day').toDate(), dayjs().endOf('day').toDate()],
  },
];

const TASK_MEDIA_TYPE_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'video', label: '视频' },
  { key: 'image', label: '图片' },
];

const createStatsBreakdown = () => ({
  running: 0,
  success: 0,
  failure: 0,
});

const shouldUseHourlyStatsBuckets = (startTimestamp, endTimestamp) => {
  if (!startTimestamp || !endTimestamp) {
    return false;
  }

  const start = dayjs.unix(Math.min(startTimestamp, endTimestamp));
  const end = dayjs.unix(Math.max(startTimestamp, endTimestamp));
  const now = dayjs();

  return start.isSame(now, 'day') && end.isSame(now, 'day');
};

const buildDailyCountBuckets = (startTimestamp, endTimestamp) => {
  if (!startTimestamp || !endTimestamp) {
    return [];
  }

  const start = dayjs.unix(Math.min(startTimestamp, endTimestamp));
  const end = dayjs.unix(Math.max(startTimestamp, endTimestamp));
  const buckets = [];
  const useHourlyBuckets = shouldUseHourlyStatsBuckets(startTimestamp, endTimestamp);

  if (useHourlyBuckets) {
    for (
      let cursor = start.startOf('hour');
      !cursor.isAfter(end.startOf('hour'));
      cursor = cursor.add(1, 'hour')
    ) {
      buckets.push({
        date: cursor.format('HH:00'),
        total: 0,
      });
    }

    return buckets;
  }

  for (
    let cursor = start.startOf('day');
    !cursor.isAfter(end.startOf('day'));
    cursor = cursor.add(1, 'day')
  ) {
    buckets.push({
      date: cursor.format('YYYY-MM-DD'),
      total: 0,
    });
  }

  return buckets;
};

const normalizeStatsData = (statsData, startTimestamp, endTimestamp) => {
  const emptyDailyCounts = buildDailyCountBuckets(startTimestamp, endTimestamp);
  const dailyCounts = Array.isArray(statsData?.daily_counts)
    ? statsData.daily_counts
    : emptyDailyCounts;

  return {
    running_count: Number(statsData?.running_count || 0),
    daily_counts: dailyCounts.length > 0 ? dailyCounts : emptyDailyCounts,
    total_stats: {
      ...createStatsBreakdown(),
      ...(statsData?.total_stats || {}),
    },
    image_stats: {
      ...createStatsBreakdown(),
      ...(statsData?.image_stats || {}),
    },
    video_stats: {
      ...createStatsBreakdown(),
      ...(statsData?.video_stats || {}),
    },
  };
};

const normalizeDateValueToTimestamp = (value, fallback = 0) => {
  if (!value) {
    return fallback;
  }

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (dayjs.isDayjs(value)) {
    return value.unix();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1000000000000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return fallback;
};

const getRangePreset = (presetKey) =>
  TASK_STATS_RANGE_PRESETS.find((preset) => preset.key === presetKey) ||
  TASK_STATS_RANGE_PRESETS.find((preset) => preset.key === DEFAULT_RANGE_PRESET);

const detectStatsRangePreset = (dateRange) => {
  if (!Array.isArray(dateRange) || dateRange.length !== 2) {
    return 'custom';
  }

  const [startTimestamp, endTimestamp] = dateRange.map((value) =>
    normalizeDateValueToTimestamp(value, 0),
  );

  if (!startTimestamp || !endTimestamp) {
    return 'custom';
  }

  const matchedPreset = TASK_STATS_RANGE_PRESETS.find((preset) => {
    const [presetStart, presetEnd] = preset
      .getRange()
      .map((value) => normalizeDateValueToTimestamp(value, 0));
    return presetStart === startTimestamp && presetEnd === endTimestamp;
  });

  return matchedPreset ? matchedPreset.key : 'custom';
};

const getDefaultDateRange = () => getRangePreset(DEFAULT_RANGE_PRESET).getRange();

export const useTaskLogsData = () => {
  const { t } = useTranslation();

  const COLUMN_KEYS = useMemo(
    () => ({
      SUBMIT_TIME: 'submit_time',
      FINISH_TIME: 'finish_time',
      DURATION: 'duration',
      CHANNEL: 'channel',
      USERNAME: 'username',
      PLATFORM: 'platform',
      TYPE: 'type',
      TASK_ID: 'task_id',
      TASK_STATUS: 'task_status',
      PROGRESS: 'progress',
      FAIL_REASON: 'fail_reason',
      RESULT_URL: 'result_url',
    }),
    [],
  );

  const isAdminUser = isAdmin();
  const STORAGE_KEY = isAdminUser
    ? 'task-logs-table-columns-admin'
    : 'task-logs-table-columns-user';

  const initialDateRange = useMemo(() => getDefaultDateRange(), []);
  const formInitValues = useMemo(
    () => ({
      channel_id: '',
      task_id: '',
      dateRange: initialDateRange,
    }),
    [initialDateRange],
  );

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [mediaType, setMediaType] = useState(DEFAULT_MEDIA_TYPE);
  const [statsRangePreset, setStatsRangePreset] = useState(DEFAULT_RANGE_PRESET);
  const [statsData, setStatsData] = useState(() =>
    normalizeStatsData(null, normalizeDateValueToTimestamp(initialDateRange[0], 0), normalizeDateValueToTimestamp(initialDateRange[1], 0)),
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [audioClips, setAudioClips] = useState([]);
  const [showUserInfo, setShowUserInfoModal] = useState(false);
  const [userInfoData, setUserInfoData] = useState(null);
  const [formApi, setFormApi] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [compactMode, setCompactMode] = useTableCompactMode('taskLogs');

  const getDefaultColumnVisibility = useCallback(() => {
    return {
      [COLUMN_KEYS.SUBMIT_TIME]: true,
      [COLUMN_KEYS.FINISH_TIME]: true,
      [COLUMN_KEYS.DURATION]: true,
      [COLUMN_KEYS.CHANNEL]: isAdminUser,
      [COLUMN_KEYS.USERNAME]: isAdminUser,
      [COLUMN_KEYS.PLATFORM]: true,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.TASK_ID]: true,
      [COLUMN_KEYS.TASK_STATUS]: true,
      [COLUMN_KEYS.PROGRESS]: true,
      [COLUMN_KEYS.FAIL_REASON]: true,
      [COLUMN_KEYS.RESULT_URL]: true,
    };
  }, [COLUMN_KEYS, isAdminUser]);

  const initDefaultColumns = useCallback(() => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  }, [STORAGE_KEY, getDefaultColumnVisibility]);

  useEffect(() => {
    const savedColumns = localStorage.getItem(STORAGE_KEY);
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        const defaults = getDefaultColumnVisibility();
        const merged = { ...defaults, ...parsed };
        if (!isAdminUser) {
          merged[COLUMN_KEYS.CHANNEL] = false;
          merged[COLUMN_KEYS.USERNAME] = false;
        }
        setVisibleColumns(merged);
        return;
      } catch (error) {
        console.error('Failed to parse saved column preferences', error);
      }
    }
    initDefaultColumns();
  }, [COLUMN_KEYS.CHANNEL, COLUMN_KEYS.USERNAME, STORAGE_KEY, getDefaultColumnVisibility, initDefaultColumns, isAdminUser]);

  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    }
  }, [STORAGE_KEY, visibleColumns]);

  const getCurrentFormValues = useCallback(
    (overrideValues = null) => {
      const rawValues = overrideValues || (formApi ? formApi.getValues() : formInitValues);
      const dateRange = Array.isArray(rawValues?.dateRange) && rawValues.dateRange.length === 2
        ? rawValues.dateRange
        : formInitValues.dateRange;

      const startTimestamp = normalizeDateValueToTimestamp(
        dateRange[0],
        normalizeDateValueToTimestamp(formInitValues.dateRange[0], 0),
      );
      const endTimestamp = normalizeDateValueToTimestamp(
        dateRange[1],
        normalizeDateValueToTimestamp(formInitValues.dateRange[1], 0),
      );

      return {
        channel_id: rawValues?.channel_id || '',
        task_id: rawValues?.task_id || '',
        dateRange,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
      };
    },
    [formApi, formInitValues],
  );

  const enrichLogs = useCallback((items) => {
    return items.map((log) => ({
      ...log,
      timestamp2string: timestamp2string(log.created_at),
      key: String(log.id),
    }));
  }, []);

  const syncPageData = useCallback(
    (payload) => {
      const items = enrichLogs(payload.items || []);
      setLogs(items);
      setLogCount(payload.total || 0);
      setActivePage(payload.page || 1);
      setPageSize(payload.page_size || pageSize);
    },
    [enrichLogs, pageSize],
  );

  const buildListUrl = useCallback(
    (page, size, filters, nextMediaType) => {
      const params = new URLSearchParams({
        p: String(page),
        page_size: String(size),
        start_timestamp: String(filters.start_timestamp),
        end_timestamp: String(filters.end_timestamp),
      });

      if (filters.task_id) {
        params.set('task_id', filters.task_id);
      }
      if (nextMediaType) {
        params.set('media_type', nextMediaType);
      }
      if (isAdminUser && filters.channel_id) {
        params.set('channel_id', filters.channel_id);
      }

      return isAdminUser
        ? `/api/task/?${params.toString()}`
        : `/api/task/self?${params.toString()}`;
    },
    [isAdminUser],
  );

  const buildStatsUrl = useCallback(
    (filters, nextMediaType) => {
      const params = new URLSearchParams({
        start_timestamp: String(filters.start_timestamp),
        end_timestamp: String(filters.end_timestamp),
        media_type: nextMediaType || DEFAULT_MEDIA_TYPE,
      });

      if (isAdminUser && filters.channel_id) {
        params.set('channel_id', filters.channel_id);
      }

      return isAdminUser
        ? `/api/task/stats?${params.toString()}`
        : `/api/task/self/stats?${params.toString()}`;
    },
    [isAdminUser],
  );

  const loadLogs = useCallback(
    async (page = 1, size = pageSize, overrideValues = null, nextMediaType = mediaType) => {
      setLoading(true);
      const filters = getCurrentFormValues(overrideValues);
      try {
        const res = await API.get(buildListUrl(page, size, filters, nextMediaType));
        const { success, message, data } = res.data;
        if (success) {
          syncPageData(data);
        } else {
          showError(message);
        }
      } catch (error) {
        showError(error?.message || t('加载任务日志失败'));
      } finally {
        setLoading(false);
      }
    },
    [buildListUrl, getCurrentFormValues, mediaType, pageSize, syncPageData, t],
  );

  const loadStats = useCallback(
    async (overrideValues = null, nextMediaType = mediaType) => {
      setStatsLoading(true);
      const filters = getCurrentFormValues(overrideValues);
      try {
        const res = await API.get(buildStatsUrl(filters, nextMediaType));
        const { success, message, data } = res.data;
        if (success) {
          setStatsData(normalizeStatsData(data, filters.start_timestamp, filters.end_timestamp));
        } else {
          showError(message);
          setStatsData(normalizeStatsData(null, filters.start_timestamp, filters.end_timestamp));
        }
      } catch (error) {
        showError(error?.message || t('加载任务统计失败'));
        setStatsData(normalizeStatsData(null, filters.start_timestamp, filters.end_timestamp));
      } finally {
        setStatsLoading(false);
      }
    },
    [buildStatsUrl, getCurrentFormValues, mediaType, t],
  );

  const refresh = useCallback(
    async (overrideValues = null, nextMediaType = mediaType) => {
      await Promise.all([
        loadLogs(1, pageSize, overrideValues, nextMediaType),
        loadStats(overrideValues, nextMediaType),
      ]);
    },
    [loadLogs, loadStats, mediaType, pageSize],
  );

  const handleSearchSubmit = useCallback(async () => {
    const currentValues = getCurrentFormValues();
    setStatsRangePreset(detectStatsRangePreset(currentValues.dateRange));
    await refresh(currentValues, mediaType);
  }, [getCurrentFormValues, mediaType, refresh]);

  const handleResetFilters = useCallback(async () => {
    const defaultDateRange = getDefaultDateRange();
    const resetValues = {
      channel_id: '',
      task_id: '',
      dateRange: defaultDateRange,
    };

    if (formApi) {
      formApi.setValues(resetValues);
    }

    setMediaType(DEFAULT_MEDIA_TYPE);
    setStatsRangePreset(DEFAULT_RANGE_PRESET);
    await refresh(resetValues, DEFAULT_MEDIA_TYPE);
  }, [formApi, refresh]);

  const handlePageChange = useCallback(
    (page) => {
      void loadLogs(page, pageSize);
    },
    [loadLogs, pageSize],
  );

  const handlePageSizeChange = useCallback(
    async (size) => {
      localStorage.setItem('task-page-size', String(size));
      setPageSize(size);
      await loadLogs(1, size);
    },
    [loadLogs],
  );

  const handleMediaTypeChange = useCallback(
    async (nextMediaType) => {
      setMediaType(nextMediaType);
      await refresh(null, nextMediaType);
    },
    [refresh],
  );

  const handleStatsRangePresetChange = useCallback(
    async (presetKey) => {
      const nextPreset = getRangePreset(presetKey);
      const nextDateRange = nextPreset.getRange();
      const nextValues = {
        ...getCurrentFormValues(),
        dateRange: nextDateRange,
      };

      if (formApi) {
        formApi.setValue('dateRange', nextDateRange);
      }

      setStatsRangePreset(presetKey);
      await refresh(nextValues, mediaType);
    },
    [formApi, getCurrentFormValues, mediaType, refresh],
  );

  const copyText = useCallback(
    async (text) => {
      if (await copy(text)) {
        showSuccess(`${t('已复制：')}${text}`);
      } else {
        Modal.error({
          title: t('无法复制到剪贴板，请手动复制'),
          content: text,
        });
      }
    },
    [t],
  );

  const openContentModal = useCallback((content) => {
    setModalContent(content);
    setIsModalOpen(true);
  }, []);

  const openVideoModal = useCallback((url) => {
    setVideoUrl(url);
    setIsVideoModalOpen(true);
  }, []);

  const openImageModal = useCallback((url) => {
    setImageUrl(url);
    setIsImageModalOpen(true);
  }, []);

  const openAudioModal = useCallback((clips) => {
    setAudioClips(clips);
    setIsAudioModalOpen(true);
  }, []);

  const showUserInfoFunc = useCallback(
    async (userId) => {
      if (!isAdminUser) {
        return;
      }
      try {
        const res = await API.get(`/api/user/${userId}`);
        const { success, message, data } = res.data;
        if (success) {
          setUserInfoData(data);
          setShowUserInfoModal(true);
        } else {
          showError(message);
        }
      } catch (error) {
        showError(error?.message || t('加载用户信息失败'));
      }
    },
    [isAdminUser, t],
  );

  const handleColumnVisibilityChange = useCallback((columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  }, [visibleColumns]);

  const handleSelectAll = useCallback((checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};

    allKeys.forEach((key) => {
      if ((key === COLUMN_KEYS.CHANNEL || key === COLUMN_KEYS.USERNAME) && !isAdminUser) {
        updatedColumns[key] = false;
      } else {
        updatedColumns[key] = checked;
      }
    });

    setVisibleColumns(updatedColumns);
  }, [COLUMN_KEYS, isAdminUser]);

  useEffect(() => {
    const localPageSize = parseInt(localStorage.getItem('task-page-size'), 10) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    void Promise.all([
      loadLogs(1, localPageSize, formInitValues, DEFAULT_MEDIA_TYPE),
      loadStats(formInitValues, DEFAULT_MEDIA_TYPE),
    ]);
  }, [formInitValues, loadLogs, loadStats]);

  return {
    logs,
    loading,
    statsLoading,
    activePage,
    logCount,
    pageSize,
    isAdminUser,
    isModalOpen,
    setIsModalOpen,
    modalContent,
    isVideoModalOpen,
    setIsVideoModalOpen,
    videoUrl,
    isImageModalOpen,
    setIsImageModalOpen,
    imageUrl,
    isAudioModalOpen,
    setIsAudioModalOpen,
    audioClips,
    formApi,
    setFormApi,
    formInitValues,
    getFormValues: getCurrentFormValues,
    visibleColumns,
    showColumnSelector,
    setShowColumnSelector,
    handleColumnVisibilityChange,
    handleSelectAll,
    initDefaultColumns,
    COLUMN_KEYS,
    compactMode,
    setCompactMode,
    showUserInfo,
    setShowUserInfoModal,
    userInfoData,
    showUserInfoFunc,
    loadLogs,
    handlePageChange,
    handlePageSizeChange,
    refresh: handleSearchSubmit,
    handleSearchSubmit,
    handleResetFilters,
    copyText,
    openContentModal,
    openVideoModal,
    openImageModal,
    openAudioModal,
    enrichLogs,
    syncPageData,
    mediaType,
    handleMediaTypeChange,
    statsRangePreset,
    handleStatsRangePresetChange,
    statsData,
    taskStatsRangePresets: TASK_STATS_RANGE_PRESETS,
    taskMediaTypeOptions: TASK_MEDIA_TYPE_OPTIONS,
    t,
  };
};
