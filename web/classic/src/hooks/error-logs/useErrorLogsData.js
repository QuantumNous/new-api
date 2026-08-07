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
  timestamp2string,
  getLogOther,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useErrorLogsData = () => {
  const { t } = useTranslation();

  const COLUMN_KEYS = {
    TIME: 'time',
    REQUEST_ID: 'request_id',
    USERNAME: 'username',
    TOKEN: 'token',
    MODEL: 'model',
    GROUP: 'group',
    CHANNEL: 'channel',
    CATEGORY: 'category',
    STATUS_CODE: 'status_code',
    CONTENT: 'content',
    USE_TIME: 'use_time',
    IS_STREAM: 'is_stream',
    REQUEST_PATH: 'request_path',
  };

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);

  // Always admin-only page
  const isAdminUser = true;
  const STORAGE_KEY = 'error-logs-table-columns-admin';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');

  const [formApi, setFormApi] = useState(null);
  let now = new Date();
  let zeroNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const formInitValues = {
    username: '',
    token_name: '',
    model_name: '',
    channel: '',
    request_id: '',
    keyword: '',
    error_category: '',
    dateRange: [
      timestamp2string(zeroNow.getTime() / 1000),
      timestamp2string(now.getTime() / 1000 + 3600),
    ],
  };

  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [compactMode, setCompactMode] = useTableCompactMode('errorLogs');

  useEffect(() => {
    const savedColumns = localStorage.getItem(STORAGE_KEY);
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        const defaults = getDefaultColumnVisibility();
        setVisibleColumns({ ...defaults, ...parsed });
      } catch (e) {
        console.error('Failed to parse saved column preferences', e);
        initDefaultColumns();
      }
    } else {
      initDefaultColumns();
    }
  }, []);

  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.TIME]: true,
      [COLUMN_KEYS.REQUEST_ID]: true,
      [COLUMN_KEYS.USERNAME]: true,
      [COLUMN_KEYS.TOKEN]: true,
      [COLUMN_KEYS.MODEL]: true,
      [COLUMN_KEYS.GROUP]: true,
      [COLUMN_KEYS.CHANNEL]: true,
      [COLUMN_KEYS.CATEGORY]: true,
      [COLUMN_KEYS.STATUS_CODE]: true,
      [COLUMN_KEYS.CONTENT]: true,
      [COLUMN_KEYS.USE_TIME]: true,
      [COLUMN_KEYS.IS_STREAM]: true,
      [COLUMN_KEYS.REQUEST_PATH]: true,
    };
  };

  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  };

  const handleColumnVisibilityChange = (columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  };

  const handleSelectAll = (checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};
    allKeys.forEach((key) => {
      updatedColumns[key] = checked;
    });
    setVisibleColumns(updatedColumns);
  };

  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};

    let start_timestamp = timestamp2string(zeroNow.getTime() / 1000);
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
      username: formValues.username || '',
      token_name: formValues.token_name || '',
      model_name: formValues.model_name || '',
      channel: formValues.channel || '',
      request_id: formValues.request_id || '',
      keyword: formValues.keyword || '',
      error_category: formValues.error_category || '',
      start_timestamp,
      end_timestamp,
    };
  };

  const enrichLogs = (items) => {
    return items.map((log) => {
      const other = getLogOther(log.other) || {};
      return {
        ...log,
        timestamp2string: timestamp2string(log.created_at),
        key: '' + log.id,
        _other: other,
      };
    });
  };

  const syncPageData = (payload) => {
    const items = enrichLogs(payload.items || []);
    setLogs(items);
    setLogCount(payload.total || 0);
    setActivePage(payload.page || 1);
    setPageSize(payload.page_size || pageSize);
  };

  const loadLogs = async (page = 1, size = pageSize) => {
    if (!isAdmin()) {
      showError(t('无权访问'));
      return;
    }
    setLoading(true);
    const {
      username,
      token_name,
      model_name,
      channel,
      request_id,
      keyword,
      error_category,
      start_timestamp,
      end_timestamp,
    } = getFormValues();
    let localStartTimestamp = parseInt(Date.parse(start_timestamp) / 1000);
    let localEndTimestamp = parseInt(Date.parse(end_timestamp) / 1000);
    let url = `/api/error-log/?p=${page}&page_size=${size}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&username=${username}&token_name=${token_name}&model_name=${model_name}&channel=${channel}&request_id=${request_id}&keyword=${keyword}&error_category=${error_category}`;
    url = encodeURI(url);
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      syncPageData(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handlePageChange = (page) => {
    loadLogs(page, pageSize).then();
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('error-logs-page-size', size + '');
    await loadLogs(1, size);
  };

  const refresh = async () => {
    await loadLogs(1, pageSize);
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  const openContentModal = (content) => {
    setModalContent(content);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const localPageSize =
      parseInt(localStorage.getItem('error-logs-page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(1, localPageSize).then();
  }, []);

  return {
    logs,
    loading,
    activePage,
    logCount,
    pageSize,
    isAdminUser,

    isModalOpen,
    setIsModalOpen,
    modalContent,

    formApi,
    setFormApi,
    formInitValues,
    getFormValues,

    visibleColumns,
    showColumnSelector,
    setShowColumnSelector,
    handleColumnVisibilityChange,
    handleSelectAll,
    initDefaultColumns,
    COLUMN_KEYS,

    compactMode,
    setCompactMode,

    loadLogs,
    handlePageChange,
    handlePageSizeChange,
    refresh,
    copyText,
    openContentModal,
    enrichLogs,
    syncPageData,

    t,
  };
};
