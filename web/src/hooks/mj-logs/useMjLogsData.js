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

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import {
  API,
  copy,
  isAdmin,
  showError,
  showSuccess,
  timestamp2string
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useMjLogsData = () => {
  const { t } = useTranslation();

  // Define column keys for selection
  const COLUMN_KEYS = {
    SUBMIT_TIME: 'submit_time',
    DURATION: 'duration',
    CHANNEL: 'channel',
    TYPE: 'type',
    TASK_ID: 'task_id',
    SUBMIT_RESULT: 'submit_result',
    TASK_STATUS: 'task_status',
    PROGRESS: 'progress',
    IMAGE: 'image',
    PROMPT: 'prompt',
    PROMPT_EN: 'prompt_en',
    FAIL_REASON: 'fail_reason',
  };

  // Basic state
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [showBanner, setShowBanner] = useState(false);

  // User and admin
  const isAdminUser = isAdmin();
  // Role-specific storage key to prevent different roles from overwriting each other
  const STORAGE_KEY = isAdminUser ? 'mj-logs-table-columns-admin' : 'mj-logs-table-columns-user';

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState('');

  // Form state
  const [formApi, setFormApi] = useState(null);
  let now = new Date();
  const formInitValues = {
    channel_id: '',
    mj_id: '',
    dateRange: [
      timestamp2string(now.getTime() / 1000 - 2592000),
      timestamp2string(now.getTime() / 1000 + 3600)
    ],
  };

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Compact mode
  const [compactMode, setCompactMode] = useTableCompactMode('mjLogs');

  // Load saved column preferences from localStorage
  useEffect(() => {
    const savedColumns = localStorage.getItem(STORAGE_KEY);
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        const defaults = getDefaultColumnVisibility();
        const merged = { ...defaults, ...parsed };

        // For non-admin users, force-hide admin-only columns (does not touch admin settings)
        if (!isAdminUser) {
          merged[COLUMN_KEYS.CHANNEL] = false;
          merged[COLUMN_KEYS.SUBMIT_RESULT] = false;
        }
        setVisibleColumns(merged);
      } catch (e) {
        console.error('Failed to parse saved column preferences', e);
        initDefaultColumns();
      }
    } else {
      initDefaultColumns();
    }
  }, []);

  // Check banner notification
  useEffect(() => {
    const mjNotifyEnabled = localStorage.getItem('mj_notify_enabled');
    if (mjNotifyEnabled !== 'true') {
      setShowBanner(true);
    }
  }, []);

  // Get default column visibility based on user role
  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.SUBMIT_TIME]: true,
      [COLUMN_KEYS.DURATION]: true,
      [COLUMN_KEYS.CHANNEL]: isAdminUser,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.TASK_ID]: true,
      [COLUMN_KEYS.SUBMIT_RESULT]: isAdminUser,
      [COLUMN_KEYS.TASK_STATUS]: true,
      [COLUMN_KEYS.PROGRESS]: true,
      [COLUMN_KEYS.IMAGE]: true,
      [COLUMN_KEYS.PROMPT]: true,
      [COLUMN_KEYS.PROMPT_EN]: true,
      [COLUMN_KEYS.FAIL_REASON]: true,
    };
  };

  // Initialize default column visibility
  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  };

  // Handle column visibility change
  const handleColumnVisibilityChange = (columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  };

  // Handle "Select All" checkbox
  const handleSelectAll = (checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};

    allKeys.forEach((key) => {
      if (
        (key === COLUMN_KEYS.CHANNEL || key === COLUMN_KEYS.SUBMIT_RESULT) &&
        !isAdminUser
      ) {
        updatedColumns[key] = false;
      } else {
        updatedColumns[key] = checked;
      }
    });

    setVisibleColumns(updatedColumns);
  };

  // Persist column settings to the role-specific STORAGE_KEY
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  // Get form values helper function
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};

    let start_timestamp = timestamp2string(now.getTime() / 1000 - 2592000);
    let end_timestamp = timestamp2string(now.getTime() / 1000 + 3600);

    if (
      formValues.dateRange &&
      Array.isArray(formValues.dateRange) &&
      formValues.dateRange.length === 2
    ) {
      start_timestamp = formValues.dateRange[0];
      end_timestamp = formValues.dateRange[1];
    }

    return {
      channel_id: formValues.channel_id || '',
      mj_id: formValues.mj_id || '',
      start_timestamp,
      end_timestamp,
    };
  };

  // Enrich logs data
  const enrichLogs = (items) => {
    return items.map((log) => ({
      ...log,
      timestamp2string: timestamp2string(log.created_at),
      key: '' + log.id,
    }));
  };

  // Sync page data
  const syncPageData = (payload) => {
    const items = enrichLogs(payload.items || []);
    setLogs(items);
    setLogCount(payload.total || 0);
    setActivePage(payload.page || 1);
    setPageSize(payload.page_size || pageSize);
  };

  // Load logs function
  const loadLogs = async (page = 1, size = pageSize) => {
    setLoading(true);
    const { channel_id, mj_id, start_timestamp, end_timestamp } = getFormValues();
    let localStartTimestamp = Date.parse(start_timestamp);
    let localEndTimestamp = Date.parse(end_timestamp);
    const url = isAdminUser
      ? `/api/mj/?p=${page}&page_size=${size}&channel_id=${channel_id}&mj_id=${mj_id}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`
      : `/api/mj/self/?p=${page}&page_size=${size}&mj_id=${mj_id}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      syncPageData(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  // Page handlers
  const handlePageChange = (page) => {
    loadLogs(page, pageSize).then();
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('mj-page-size', size + '');
    await loadLogs(1, size);
  };

  // Refresh function
  const refresh = async () => {
    await loadLogs(1, pageSize);
  };

  // Copy text function
  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  // Modal handlers
  const openContentModal = (content) => {
    setModalContent(content);
    setIsModalOpen(true);
  };

  const openImageModal = (imageUrl) => {
    setModalImageUrl(imageUrl);
    setIsModalOpenurl(true);
  };

  // Initialize data
  useEffect(() => {
    const localPageSize = parseInt(localStorage.getItem('mj-page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(1, localPageSize).then();
  }, []);

  return {
    // Basic state
    logs,
    loading,
    activePage,
    logCount,
    pageSize,
    showBanner,
    isAdminUser,

    // Modal state
    isModalOpen,
    setIsModalOpen,
    modalContent,
    isModalOpenurl,
    setIsModalOpenurl,
    modalImageUrl,

    // Form state
    formApi,
    setFormApi,
    formInitValues,
    getFormValues,

    // Column visibility
    visibleColumns,
    showColumnSelector,
    setShowColumnSelector,
    handleColumnVisibilityChange,
    handleSelectAll,
    initDefaultColumns,
    COLUMN_KEYS,

    // Compact mode
    compactMode,
    setCompactMode,

    // Functions
    loadLogs,
    handlePageChange,
    handlePageSizeChange,
    refresh,
    copyText,
    openContentModal,
    openImageModal,
    enrichLogs,
    syncPageData,

    // Translation
    t,
  };
}; 