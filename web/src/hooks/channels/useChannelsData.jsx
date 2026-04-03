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

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  loadChannelModels,
  copy,
  toBoolean,
} from '../../helpers';
import {
  CHANNEL_OPTIONS,
  ITEMS_PER_PAGE,
  MODEL_TABLE_PAGE_SIZE,
} from '../../constants';
import { useIsMobile } from '../common/useIsMobile';
import { useTableCompactMode } from '../common/useTableCompactMode';
import { useChannelUpstreamUpdates } from './useChannelUpstreamUpdates';
import { parseUpstreamUpdateMeta } from './upstreamUpdateUtils';
import { Modal, Button } from '@douyinfe/semi-ui';
import { openCodexUsageModal } from '../../components/table/channels/modals/CodexUsageModal';

const UNGROUPED_TAG_KEY = '__untagged__';
const INTERACTIVE_SELECTION_EXCLUDE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[role="button"]',
  '.semi-button',
  '.semi-switch',
  '.semi-select',
  '.semi-dropdown',
  '.semi-popover',
  '.semi-modal',
  '.semi-tag',
  '.semi-table-row-expand-icon',
].join(', ');

const toChannelRecordKey = (record) => {
  if (!record) return '';
  const rawKey = record.key ?? record.id;
  if (rawKey === undefined || rawKey === null) return '';
  return String(rawKey);
};

const flattenChannelRecords = (records = []) => {
  const flattened = [];
  records.forEach((record) => {
    flattened.push(record);
    if (Array.isArray(record?.children) && record.children.length > 0) {
      flattened.push(...flattenChannelRecords(record.children));
    }
  });
  return flattened;
};

const normalizeChannelId = (id) => {
  if (typeof id === 'number' && Number.isFinite(id)) {
    return id;
  }
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    return Number(id);
  }
  return null;
};

export const useChannelsData = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // Basic states
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [idSort, setIdSort] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [channelCount, setChannelCount] = useState(0);
  const [groupOptions, setGroupOptions] = useState([]);

  // UI states
  const [showEdit, setShowEdit] = useState(false);
  const [enableBatchDelete, setEnableBatchDelete] = useState(false);
  const [editingChannel, setEditingChannel] = useState({ id: undefined });
  const [showEditTag, setShowEditTag] = useState(false);
  const [editingTag, setEditingTag] = useState('');
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedChannelRowKeys, setSelectedChannelRowKeys] = useState([]);
  const [lastSelectedRowKey, setLastSelectedRowKey] = useState('');
  const [enableTagMode, setEnableTagMode] = useState(false);
  const [showBatchSetTag, setShowBatchSetTag] = useState(false);
  const [batchSetTagValue, setBatchSetTagValue] = useState('');
  const [compactMode, setCompactMode] = useTableCompactMode('channels');

  // Column visibility states
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState(
    localStorage.getItem('channel-status-filter') || 'all',
  );

  // Type tabs states
  const [activeTypeKey, setActiveTypeKey] = useState('all');
  const [typeCounts, setTypeCounts] = useState({});

  // Model test states
  const [showModelTestModal, setShowModelTestModal] = useState(false);
  const [currentTestChannel, setCurrentTestChannel] = useState(null);
  const [modelSearchKeyword, setModelSearchKeyword] = useState('');
  const [modelTestResults, setModelTestResults] = useState({});
  const [testingModels, setTestingModels] = useState(new Set());
  const [selectedModelKeys, setSelectedModelKeys] = useState([]);
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [modelTablePage, setModelTablePage] = useState(1);
  const [selectedEndpointType, setSelectedEndpointType] = useState('');
  const [isStreamTest, setIsStreamTest] = useState(false);
  const [globalPassThroughEnabled, setGlobalPassThroughEnabled] =
    useState(false);

  const fetchGlobalPassThroughEnabled = async () => {
    try {
      const res = await API.get('/api/option/');
      const { success, data } = res?.data || {};
      if (!success || !Array.isArray(data)) {
        return;
      }
      const option = data.find(
        (item) => item?.key === 'global.pass_through_request_enabled',
      );
      if (option) {
        setGlobalPassThroughEnabled(toBoolean(option.value));
      }
    } catch (error) {
      setGlobalPassThroughEnabled(false);
    }
  };

  // 使用 ref 来避免闭包问题，类似旧版实现
  const shouldStopBatchTestingRef = useRef(false);

  // Multi-key management states
  const [showMultiKeyManageModal, setShowMultiKeyManageModal] = useState(false);
  const [currentMultiKeyChannel, setCurrentMultiKeyChannel] = useState(null);

  // Refs
  const requestCounter = useRef(0);
  const allSelectingRef = useRef(false);
  const skipNextSelectionChangeRef = useRef(false);
  const shiftKeyPressedRef = useRef(false);
  const [formApi, setFormApi] = useState(null);

  const formInitValues = {
    searchKeyword: '',
    searchGroup: '',
    searchModel: '',
  };

  // Column keys
  const COLUMN_KEYS = {
    ID: 'id',
    NAME: 'name',
    GROUP: 'group',
    TYPE: 'type',
    STATUS: 'status',
    RESPONSE_TIME: 'response_time',
    BALANCE: 'balance',
    PRIORITY: 'priority',
    WEIGHT: 'weight',
    OPERATE: 'operate',
  };

  // Initialize from localStorage
  useEffect(() => {
    const localIdSort = localStorage.getItem('id-sort') === 'true';
    const localPageSize =
      parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    const localEnableTagMode =
      localStorage.getItem('enable-tag-mode') === 'true';
    const localEnableBatchDelete =
      localStorage.getItem('enable-batch-delete') === 'true';

    setIdSort(localIdSort);
    setPageSize(localPageSize);
    setEnableTagMode(localEnableTagMode);
    setEnableBatchDelete(localEnableBatchDelete);

    loadChannels(1, localPageSize, localIdSort, localEnableTagMode)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    fetchGroups().then();
    loadChannelModels().then();
    fetchGlobalPassThroughEnabled().then();
  }, []);

  // Column visibility management
  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.ID]: true,
      [COLUMN_KEYS.NAME]: true,
      [COLUMN_KEYS.GROUP]: true,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.STATUS]: true,
      [COLUMN_KEYS.RESPONSE_TIME]: true,
      [COLUMN_KEYS.BALANCE]: true,
      [COLUMN_KEYS.PRIORITY]: true,
      [COLUMN_KEYS.WEIGHT]: true,
      [COLUMN_KEYS.OPERATE]: true,
    };
  };

  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
  };

  // Load saved column preferences
  useEffect(() => {
    const savedColumns = localStorage.getItem('channels-table-columns');
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        const defaults = getDefaultColumnVisibility();
        const merged = { ...defaults, ...parsed };
        setVisibleColumns(merged);
      } catch (e) {
        console.error('Failed to parse saved column preferences', e);
        initDefaultColumns();
      }
    } else {
      initDefaultColumns();
    }
  }, []);

  // Save column preferences
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem(
        'channels-table-columns',
        JSON.stringify(visibleColumns),
      );
    }
  }, [visibleColumns]);

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

  // Data formatting
  const setChannelFormat = (channels, enableTagMode) => {
    let channelDates = [];
    let channelTags = {};

    for (let i = 0; i < channels.length; i++) {
      channels[i].upstreamUpdateMeta = parseUpstreamUpdateMeta(
        channels[i].settings,
      );
      channels[i].key = '' + channels[i].id;
      if (!enableTagMode) {
        channelDates.push(channels[i]);
      } else {
        const rawTag =
          typeof channels[i].tag === 'string' ? channels[i].tag.trim() : '';
        const normalizedTagKey =
          rawTag === '' ? UNGROUPED_TAG_KEY : String(rawTag);
        let tagIndex = channelTags[normalizedTagKey];
        let tagChannelDates = undefined;

        if (tagIndex === undefined) {
          channelTags[normalizedTagKey] = 1;
          tagChannelDates = {
            key: normalizedTagKey,
            id: normalizedTagKey,
            tag: rawTag,
            name: t('标签：{{tag}}', { tag: rawTag === '' ? t('其他') : rawTag }),
            group: '',
            used_quota: 0,
            response_time: 0,
            priority: -1,
            weight: -1,
          };
          tagChannelDates.children = [];
          channelDates.push(tagChannelDates);
        } else {
          tagChannelDates = channelDates.find(
            (item) => item.key === normalizedTagKey,
          );
        }

        if (tagChannelDates.priority === -1) {
          tagChannelDates.priority = channels[i].priority;
        } else {
          if (tagChannelDates.priority !== channels[i].priority) {
            tagChannelDates.priority = '';
          }
        }

        if (tagChannelDates.weight === -1) {
          tagChannelDates.weight = channels[i].weight;
        } else {
          if (tagChannelDates.weight !== channels[i].weight) {
            tagChannelDates.weight = '';
          }
        }

        if (tagChannelDates.group === '') {
          tagChannelDates.group = channels[i].group;
        } else {
          let channelGroupsStr = channels[i].group;
          channelGroupsStr.split(',').forEach((item, index) => {
            if (tagChannelDates.group.indexOf(item) === -1) {
              tagChannelDates.group += ',' + item;
            }
          });
        }

        tagChannelDates.children.push(channels[i]);
        if (channels[i].status === 1) {
          tagChannelDates.status = 1;
        }
        tagChannelDates.used_quota += channels[i].used_quota;
        tagChannelDates.response_time += channels[i].response_time;
        tagChannelDates.response_time = tagChannelDates.response_time / 2;
      }
    }
    setChannels(channelDates);
  };

  const flattenedChannels = useMemo(
    () => flattenChannelRecords(channels),
    [channels],
  );

  const channelRecordMap = useMemo(() => {
    const map = new Map();
    flattenedChannels.forEach((record) => {
      const key = toChannelRecordKey(record);
      if (!key) return;
      map.set(key, record);
    });
    return map;
  }, [flattenedChannels]);

  const channelSelectionOrderKeys = useMemo(
    () =>
      flattenedChannels
        .map((record) => toChannelRecordKey(record))
        .filter((key) => key !== ''),
    [flattenedChannels],
  );

  const allChannelSelectableKeys = useMemo(() => {
    const allKeys = [];
    channels.forEach((channel) => {
      const parentKey = toChannelRecordKey(channel);
      if (parentKey) {
        allKeys.push(parentKey);
      }
      if (Array.isArray(channel?.children) && channel.children.length > 0) {
        channel.children.forEach((child) => {
          const childKey = toChannelRecordKey(child);
          if (childKey) {
            allKeys.push(childKey);
          }
        });
      }
    });
    return allKeys;
  }, [channels]);

  const normalizeChannelSelectionKeys = useCallback(
    (rawSelectedKeys = [], previousSelectedKeys = []) => {
      const normalizedSet = new Set();
      const previousSet = new Set(previousSelectedKeys.map((key) => String(key)));
      const rawSet = new Set();

      rawSelectedKeys.forEach((rawKey) => {
        const key = String(rawKey ?? '');
        if (!key || !channelRecordMap.has(key)) {
          return;
        }
        rawSet.add(key);
        normalizedSet.add(key);
      });

      const addedSet = new Set(
        [...rawSet].filter((key) => !previousSet.has(key)),
      );
      const removedSet = new Set(
        [...previousSet].filter((key) => !rawSet.has(key)),
      );

      // When parent rows are toggled directly, mirror that intent to all children.
      channels.forEach((channel) => {
        if (!Array.isArray(channel?.children) || channel.children.length === 0) {
          return;
        }
        const parentKey = toChannelRecordKey(channel);
        if (!parentKey) {
          return;
        }
        const childKeys = channel.children
          .map((child) => toChannelRecordKey(child))
          .filter((key) => key !== '');
        if (childKeys.length === 0) {
          return;
        }

        if (addedSet.has(parentKey)) {
          childKeys.forEach((childKey) => normalizedSet.add(childKey));
        }
        if (removedSet.has(parentKey)) {
          childKeys.forEach((childKey) => normalizedSet.delete(childKey));
        }
      });

      // Keep parent row selected only when all children are selected.
      channels.forEach((channel) => {
        if (!Array.isArray(channel?.children) || channel.children.length === 0) {
          return;
        }
        const parentKey = toChannelRecordKey(channel);
        if (!parentKey) {
          return;
        }
        const childKeys = channel.children
          .map((child) => toChannelRecordKey(child))
          .filter((key) => key !== '');
        if (childKeys.length === 0) {
          return;
        }

        const selectedChildCount = childKeys.filter((childKey) =>
          normalizedSet.has(childKey),
        ).length;
        if (selectedChildCount === childKeys.length) {
          normalizedSet.add(parentKey);
        } else {
          normalizedSet.delete(parentKey);
        }
      });

      return channelSelectionOrderKeys.filter((key) => normalizedSet.has(key));
    },
    [channelRecordMap, channelSelectionOrderKeys, channels],
  );

  const applySelectionByRowKeys = useCallback(
    (rawSelectedKeys = [], previousSelectedKeys = selectedChannelRowKeys) => {
      const normalizedRowKeys = normalizeChannelSelectionKeys(
        rawSelectedKeys,
        previousSelectedKeys,
      );
      const selectedLeafChannelMap = new Map();

      normalizedRowKeys.forEach((key) => {
        const record = channelRecordMap.get(key);
        if (!record || Array.isArray(record?.children)) {
          return;
        }
        const normalizedId = normalizeChannelId(record?.id);
        if (normalizedId !== null) {
          selectedLeafChannelMap.set(normalizedId, record);
        }
      });

      setSelectedChannelRowKeys(normalizedRowKeys);
      setSelectedChannels(Array.from(selectedLeafChannelMap.values()));
      return normalizedRowKeys;
    },
    [channelRecordMap, normalizeChannelSelectionKeys, selectedChannelRowKeys],
  );

  const handleChannelRowSelectionChange = useCallback(
    (rawSelectedKeys) => {
      if (skipNextSelectionChangeRef.current) {
        skipNextSelectionChangeRef.current = false;
        return;
      }

      const rawKeyStrings = Array.isArray(rawSelectedKeys)
        ? rawSelectedKeys.map((key) => String(key))
        : [];
      const previousKeyStrings = selectedChannelRowKeys.map((key) => String(key));
      const rawSet = new Set(rawKeyStrings);
      const previousSet = new Set(previousKeyStrings);
      const addedKeys = rawKeyStrings.filter((key) => !previousSet.has(key));
      const removedKeys = previousKeyStrings.filter((key) => !rawSet.has(key));
      const changedKey =
        addedKeys[addedKeys.length - 1] || removedKeys[removedKeys.length - 1] || '';

      if (shiftKeyPressedRef.current && lastSelectedRowKey) {
        if (changedKey) {
          const startIndex = channelSelectionOrderKeys.indexOf(lastSelectedRowKey);
          const endIndex = channelSelectionOrderKeys.indexOf(changedKey);
          if (startIndex !== -1 && endIndex !== -1) {
            const [start, end] =
              startIndex < endIndex
                ? [startIndex, endIndex]
                : [endIndex, startIndex];
            const rangeKeys = channelSelectionOrderKeys.slice(start, end + 1);

            let nextRowKeys = rangeKeys;
            if (removedKeys.includes(changedKey)) {
              const nextSet = new Set(previousKeyStrings);
              rangeKeys.forEach((key) => nextSet.delete(key));
              nextRowKeys = channelSelectionOrderKeys.filter((key) =>
                nextSet.has(key),
              );
            }

            const normalizedRowKeys = applySelectionByRowKeys(
              nextRowKeys,
              selectedChannelRowKeys,
            );
            if (normalizedRowKeys.length === 0) {
              setLastSelectedRowKey('');
            } else {
              setLastSelectedRowKey(String(changedKey));
            }
            return;
          }
        }
      }

      const normalizedRowKeys = applySelectionByRowKeys(
        rawSelectedKeys,
        selectedChannelRowKeys,
      );
      if (!Array.isArray(normalizedRowKeys) || normalizedRowKeys.length === 0) {
        setLastSelectedRowKey('');
        return;
      }
      setLastSelectedRowKey(changedKey || String(normalizedRowKeys[normalizedRowKeys.length - 1]));
    },
    [
      applySelectionByRowKeys,
      selectedChannelRowKeys,
      lastSelectedRowKey,
      channelSelectionOrderKeys,
    ],
  );

  // Get form values helper
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchGroup: formValues.searchGroup || '',
      searchModel: formValues.searchModel || '',
    };
  };

  // Load channels
  const loadChannels = async (
    page,
    pageSize,
    idSort,
    enableTagMode,
    typeKey = activeTypeKey,
    statusF,
  ) => {
    if (statusF === undefined) statusF = statusFilter;

    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    if (searchKeyword !== '' || searchGroup !== '' || searchModel !== '') {
      setLoading(true);
      await searchChannels(
        enableTagMode,
        typeKey,
        statusF,
        page,
        pageSize,
        idSort,
      );
      setLoading(false);
      return;
    }

    const reqId = ++requestCounter.current;
    setLoading(true);
    const typeParam = typeKey !== 'all' ? `&type=${typeKey}` : '';
    const statusParam = statusF !== 'all' ? `&status=${statusF}` : '';
    const res = await API.get(
      `/api/channel/?p=${page}&page_size=${pageSize}&id_sort=${idSort}&tag_mode=${enableTagMode}${typeParam}${statusParam}`,
    );

    if (res === undefined || reqId !== requestCounter.current) {
      return;
    }

    const { success, message, data } = res.data;
    if (success) {
      const { items, total, type_counts } = data;
      if (type_counts) {
        const sumAll = Object.values(type_counts).reduce(
          (acc, v) => acc + v,
          0,
        );
        setTypeCounts({ ...type_counts, all: sumAll });
      }
      setChannelFormat(items, enableTagMode);
      setChannelCount(total);
    } else {
      showError(message, { apiMessage: true });
    }
    setLoading(false);
  };

  // Search channels
  const searchChannels = async (
    enableTagMode,
    typeKey = activeTypeKey,
    statusF = statusFilter,
    page = 1,
    pageSz = pageSize,
    sortFlag = idSort,
  ) => {
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    setSearching(true);
    try {
      if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
        await loadChannels(
          page,
          pageSz,
          sortFlag,
          enableTagMode,
          typeKey,
          statusF,
        );
        return;
      }

      const typeParam = typeKey !== 'all' ? `&type=${typeKey}` : '';
      const statusParam = statusF !== 'all' ? `&status=${statusF}` : '';
      const res = await API.get(
        `/api/channel/search?keyword=${searchKeyword}&group=${searchGroup}&model=${searchModel}&id_sort=${sortFlag}&tag_mode=${enableTagMode}&p=${page}&page_size=${pageSz}${typeParam}${statusParam}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const { items = [], total = 0, type_counts = {} } = data;
        const sumAll = Object.values(type_counts).reduce(
          (acc, v) => acc + v,
          0,
        );
        setTypeCounts({ ...type_counts, all: sumAll });
        setChannelFormat(items, enableTagMode);
        setChannelCount(total);
        setActivePage(page);
      } else {
        showError(message, { apiMessage: true });
      }
    } finally {
      setSearching(false);
    }
  };

  // Refresh
  const refresh = async (page = activePage) => {
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
      await loadChannels(page, pageSize, idSort, enableTagMode);
    } else {
      await searchChannels(
        enableTagMode,
        activeTypeKey,
        statusFilter,
        page,
        pageSize,
        idSort,
      );
    }
  };

  const upstreamUpdates = useChannelUpstreamUpdates({ t, refresh });

  const isChannelEditModeOpen =
    showEdit ||
    showEditTag ||
    showBatchSetTag ||
    showModelTestModal ||
    showMultiKeyManageModal ||
    upstreamUpdates.showUpstreamUpdateModal;

  useEffect(() => {
    if (!enableBatchDelete) {
      setSelectedChannels([]);
      setSelectedChannelRowKeys([]);
      setLastSelectedRowKey('');
    }
  }, [enableBatchDelete]);

  useEffect(() => {
    setSelectedChannels([]);
    setSelectedChannelRowKeys([]);
    setLastSelectedRowKey('');
  }, [enableTagMode]);

  useEffect(() => {
    if (selectedChannelRowKeys.length === 0) {
      return;
    }
    applySelectionByRowKeys(selectedChannelRowKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  useEffect(() => {
    if (!enableBatchDelete || isMobile) {
      return;
    }
    const handleSelectAllByShortcut = (event) => {
      const key = String(event.key || '').toLowerCase();
      const selectAllPressed =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        key === 'a';
      if (!selectAllPressed || isChannelEditModeOpen) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      const selectedKeySet = new Set(
        selectedChannelRowKeys.map((rowKey) => String(rowKey)),
      );
      const allSelected =
        allChannelSelectableKeys.length > 0 &&
        allChannelSelectableKeys.every((rowKey) =>
          selectedKeySet.has(String(rowKey)),
        );

      if (allSelected) {
        applySelectionByRowKeys([]);
        setLastSelectedRowKey('');
        return;
      }

      const normalizedRowKeys = applySelectionByRowKeys(
        allChannelSelectableKeys,
        selectedChannelRowKeys,
      );
      if (normalizedRowKeys.length > 0) {
        setLastSelectedRowKey(
          String(normalizedRowKeys[normalizedRowKeys.length - 1]),
        );
      }
    };

    document.addEventListener('keydown', handleSelectAllByShortcut, true);
    return () => {
      document.removeEventListener('keydown', handleSelectAllByShortcut, true);
    };
  }, [
    enableBatchDelete,
    isMobile,
    isChannelEditModeOpen,
    allChannelSelectableKeys,
    selectedChannelRowKeys,
    applySelectionByRowKeys,
  ]);

  useEffect(() => {
    if (!enableBatchDelete || isMobile) {
      shiftKeyPressedRef.current = false;
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Shift') {
        shiftKeyPressedRef.current = true;
      }
    };
    const handleKeyUp = (event) => {
      if (event.key === 'Shift') {
        shiftKeyPressedRef.current = false;
      }
    };
    const handleWindowBlur = () => {
      shiftKeyPressedRef.current = false;
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [enableBatchDelete, isMobile]);

  // Channel management
  const manageChannel = async (id, action, record, value) => {
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/channel/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/channel/', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/channel/', data);
        break;
      case 'priority':
        if (value === '') return;
        data.priority = parseInt(value);
        res = await API.put('/api/channel/', data);
        break;
      case 'weight':
        if (value === '') return;
        data.weight = parseInt(value);
        if (data.weight < 0) data.weight = 0;
        res = await API.put('/api/channel/', data);
        break;
      case 'enable_all':
        data.channel_info = record.channel_info;
        data.channel_info.multi_key_status_list = {};
        res = await API.put('/api/channel/', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      let channel = res.data.data;
      let newChannels = [...channels];
      if (action !== 'delete') {
        record.status = channel.status;
      }
      setChannels(newChannels);
    } else {
      showError(message, { apiMessage: true });
    }
  };

  // Tag management
  const manageTag = async (tag, action) => {
    let res;
    switch (action) {
      case 'enable':
        res = await API.post('/api/channel/tag/enabled', { tag: tag });
        break;
      case 'disable':
        res = await API.post('/api/channel/tag/disabled', { tag: tag });
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      let newChannels = [...channels];
      for (let i = 0; i < newChannels.length; i++) {
        if (newChannels[i].tag === tag) {
          let status = action === 'enable' ? 1 : 2;
          newChannels[i]?.children?.forEach((channel) => {
            channel.status = status;
          });
          newChannels[i].status = status;
        }
      }
      setChannels(newChannels);
    } else {
      showError(message, { apiMessage: true });
    }
  };

  // Page handlers
  const handlePageChange = (page) => {
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    setActivePage(page);
    if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
      loadChannels(page, pageSize, idSort, enableTagMode).then(() => {});
    } else {
      searchChannels(
        enableTagMode,
        activeTypeKey,
        statusFilter,
        page,
        pageSize,
        idSort,
      );
    }
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
      loadChannels(1, size, idSort, enableTagMode)
        .then()
        .catch((reason) => {
          showError(reason);
        });
    } else {
      searchChannels(
        enableTagMode,
        activeTypeKey,
        statusFilter,
        1,
        size,
        idSort,
      );
    }
  };

  // Fetch groups
  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      if (res === undefined) return;
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  // Copy channel
  const copySelectedChannel = async (record) => {
    try {
      const res = await API.post(`/api/channel/copy/${record.id}`);
      if (res?.data?.success) {
        showSuccess(t('渠道复制成功'));
        await refresh();
      } else {
        showError(res?.data?.message || t('渠道复制失败'));
      }
    } catch (error) {
      showError(
        t('渠道复制失败: ') +
          (error?.response?.data?.message || error?.message || error),
      );
    }
  };

  // Update channel property
  const updateChannelProperty = (channelId, updateFn) => {
    const newChannels = [...channels];
    let updated = false;

    newChannels.forEach((channel) => {
      if (channel.children !== undefined) {
        channel.children.forEach((child) => {
          if (child.id === channelId) {
            updateFn(child);
            updated = true;
          }
        });
      } else if (channel.id === channelId) {
        updateFn(channel);
        updated = true;
      }
    });

    if (updated) {
      setChannels(newChannels);
    }
  };

  // Tag edit
  const submitTagEdit = async (type, data) => {
    switch (type) {
      case 'priority':
        if (data.priority === undefined || data.priority === '') {
          showInfo(t('优先级必须是整数！'));
          return;
        }
        data.priority = parseInt(data.priority);
        break;
      case 'weight':
        if (
          data.weight === undefined ||
          data.weight < 0 ||
          data.weight === ''
        ) {
          showInfo(t('权重必须是非负整数！'));
          return;
        }
        data.weight = parseInt(data.weight);
        break;
    }

    try {
      const res = await API.put('/api/channel/tag', data);
      if (res?.data?.success) {
        showSuccess(t('更新成功！'));
        await refresh();
      }
    } catch (error) {
      showError(error);
    }
  };

  // Close edit
  const closeEdit = () => {
    setShowEdit(false);
  };

  // Row style
  const handleRow = (record, index) => {
    const rowStyle =
      record.status !== 1
        ? {
            background: 'var(--semi-color-disabled-border)',
          }
        : undefined;

    return {
      ...(rowStyle ? { style: rowStyle } : {}),
      onClick: (event) => {
        if (!enableBatchDelete) {
          return;
        }
        const metaPressed = event.metaKey || event.ctrlKey;
        const shiftPressed = event.shiftKey;
        if (!metaPressed && !shiftPressed) {
          return;
        }
        const target = event.target;
        const clickedFromCheckbox =
          target instanceof HTMLElement && Boolean(target.closest('.semi-checkbox'));
        if (
          target instanceof HTMLElement &&
          !clickedFromCheckbox &&
          target.closest(INTERACTIVE_SELECTION_EXCLUDE_SELECTOR)
        ) {
          return;
        }

        const clickedRowKey = toChannelRecordKey(record);
        if (!clickedRowKey) {
          return;
        }

        let nextRowKeys = [];

        if (shiftPressed && lastSelectedRowKey) {
          const startIndex = channelSelectionOrderKeys.indexOf(lastSelectedRowKey);
          const endIndex = channelSelectionOrderKeys.indexOf(clickedRowKey);
          if (startIndex !== -1 && endIndex !== -1) {
            const [start, end] =
              startIndex < endIndex
                ? [startIndex, endIndex]
                : [endIndex, startIndex];
            const rangeKeys = channelSelectionOrderKeys.slice(start, end + 1);
            nextRowKeys = metaPressed
              ? Array.from(new Set([...selectedChannelRowKeys, ...rangeKeys]))
              : rangeKeys;
          }
        }

        if (nextRowKeys.length === 0) {
          if (metaPressed) {
            nextRowKeys = selectedChannelRowKeys.includes(clickedRowKey)
              ? selectedChannelRowKeys.filter((key) => key !== clickedRowKey)
              : [...selectedChannelRowKeys, clickedRowKey];
          } else {
            nextRowKeys = [clickedRowKey];
          }
        }

        skipNextSelectionChangeRef.current = true;
        const normalizedRowKeys = applySelectionByRowKeys(
          nextRowKeys,
          selectedChannelRowKeys,
        );
        if (normalizedRowKeys.length === 0) {
          setLastSelectedRowKey('');
        } else {
          setLastSelectedRowKey(clickedRowKey);
        }
      },
    };
  };

  const getSelectedChannelIds = useCallback(() => {
    const idSet = new Set();
    selectedChannels.forEach((channel) => {
      const normalizedId = normalizeChannelId(channel?.id);
      if (normalizedId !== null) {
        idSet.add(normalizedId);
      }
    });
    return Array.from(idSet);
  }, [selectedChannels]);

  // Batch operations
  const batchSetChannelTag = async () => {
    const ids = getSelectedChannelIds();
    if (ids.length === 0) {
      showError(t('请先选择要设置标签的渠道！'));
      return;
    }
    if (batchSetTagValue === '') {
      showError(t('标签不能为空！'));
      return;
    }
    const res = await API.post('/api/channel/batch/tag', {
      ids: ids,
      tag: batchSetTagValue === '' ? null : batchSetTagValue,
    });
    if (res.data.success) {
      showSuccess(
        t('已为 ${count} 个渠道设置标签！').replace('${count}', res.data.data),
      );
      await refresh();
      setShowBatchSetTag(false);
      setSelectedChannels([]);
      setSelectedChannelRowKeys([]);
      setLastSelectedRowKey('');
    } else {
      showError(res.data.message, { apiMessage: true });
    }
  };

  const batchDeleteChannels = async () => {
    const ids = getSelectedChannelIds();
    if (ids.length === 0) {
      showError(t('请先选择要删除的通道！'));
      return;
    }
    setLoading(true);
    const res = await API.post(`/api/channel/batch`, { ids: ids });
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(t('已删除 ${data} 个通道！').replace('${data}', data));
      await refresh();
      setSelectedChannels([]);
      setSelectedChannelRowKeys([]);
      setLastSelectedRowKey('');
      setTimeout(() => {
        if (channels.length === 0 && activePage > 1) {
          refresh(activePage - 1);
        }
      }, 100);
    } else {
      showError(message, { apiMessage: true });
    }
    setLoading(false);
  };

  // Channel operations
  const testAllChannels = async () => {
    const res = await API.get(`/api/channel/test`);
    const { success, message } = res.data;
    if (success) {
      showInfo(t('已成功开始测试所有已启用通道，请刷新页面查看结果。'));
    } else {
      showError(message, { apiMessage: true });
    }
  };

  const deleteAllDisabledChannels = async () => {
    const res = await API.delete(`/api/channel/disabled`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(
        t('已删除所有禁用渠道，共计 ${data} 个').replace('${data}', data),
      );
      await refresh();
    } else {
      showError(message, { apiMessage: true });
    }
  };

  const updateAllChannelsBalance = async () => {
    const res = await API.get(`/api/channel/update_balance`);
    const { success, message } = res.data;
    if (success) {
      showInfo(t('已更新完毕所有已启用通道余额！'));
    } else {
      showError(message, { apiMessage: true });
    }
  };

  const updateChannelBalance = async (record) => {
    if (record?.type === 57) {
      openCodexUsageModal({
        t,
        record,
        onCopy: async (text) => {
          const ok = await copy(text);
          if (ok) showSuccess(t('已复制'));
          else showError(t('复制失败'));
        },
      });
      return;
    }

    const res = await API.get(`/api/channel/update_balance/${record.id}/`);
    const { success, message, balance } = res.data;
    if (success) {
      updateChannelProperty(record.id, (channel) => {
        channel.balance = balance;
        channel.balance_updated_time = Date.now() / 1000;
      });
      showInfo(
        t('通道 ${name} 余额更新成功！').replace('${name}', record.name),
      );
    } else {
      showError(message, { apiMessage: true });
    }
  };

  const fixChannelsAbilities = async () => {
    const res = await API.post(`/api/channel/fix`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(
        t('已修复 ${success} 个通道，失败 ${fails} 个通道。')
          .replace('${success}', data.success)
          .replace('${fails}', data.fails),
      );
      await refresh();
    } else {
      showError(message, { apiMessage: true });
    }
  };

  const checkOllamaVersion = async (record) => {
    try {
      const res = await API.get(`/api/channel/ollama/version/${record.id}`);
      const { success, message, data } = res.data;

      if (success) {
        const version = data?.version || '-';
        const infoMessage = t('当前 Ollama 版本为 ${version}').replace(
          '${version}',
          version,
        );

        const handleCopyVersion = async () => {
          if (!version || version === '-') {
            showInfo(t('暂无可复制的版本信息'));
            return;
          }

          const copied = await copy(version);
          if (copied) {
            showSuccess(t('已复制版本号'));
          } else {
            showError(t('复制失败，请手动复制'));
          }
        };

        Modal.info({
          title: t('Ollama 版本信息'),
          content: infoMessage,
          centered: true,
          footer: (
            <div className='flex justify-end gap-2'>
              <Button type='tertiary' onClick={handleCopyVersion}>
                {t('复制版本号')}
              </Button>
              <Button
                type='primary'
                theme='solid'
                onClick={() => Modal.destroyAll()}
              >
                {t('关闭')}
              </Button>
            </div>
          ),
          hasCancel: false,
          hasOk: false,
          closable: true,
          maskClosable: true,
        });
      } else {
        showError(message || t('获取 Ollama 版本失败'));
      }
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        t('获取 Ollama 版本失败');
      showError(errMsg);
    }
  };

  // Test channel - 单个模型测试，参考旧版实现
  const testChannel = async (
    record,
    model,
    endpointType = '',
    stream = false,
  ) => {
    const testKey = `${record.id}-${model}`;

    // 检查是否应该停止批量测试
    if (shouldStopBatchTestingRef.current && isBatchTesting) {
      return Promise.resolve();
    }

    // 添加到正在测试的模型集合
    setTestingModels((prev) => new Set([...prev, model]));

    try {
      let url = `/api/channel/test/${record.id}?model=${model}`;
      if (endpointType) {
        url += `&endpoint_type=${endpointType}`;
      }
      if (stream) {
        url += `&stream=true`;
      }
      const res = await API.get(url);

      // 检查是否在请求期间被停止
      if (shouldStopBatchTestingRef.current && isBatchTesting) {
        return Promise.resolve();
      }

      const { success, message, time } = res.data;

      // 更新测试结果
      setModelTestResults((prev) => ({
        ...prev,
        [testKey]: {
          success,
          message,
          time: time || 0,
          timestamp: Date.now(),
        },
      }));

      if (success) {
        // 更新渠道响应时间
        updateChannelProperty(record.id, (channel) => {
          channel.response_time = time * 1000;
          channel.test_time = Date.now() / 1000;
        });

        if (!model || model === '') {
          showInfo(
            t('通道 ${name} 测试成功，耗时 ${time.toFixed(2)} 秒。')
              .replace('${name}', record.name)
              .replace('${time.toFixed(2)}', time.toFixed(2)),
          );
        } else {
          showInfo(
            t(
              '通道 ${name} 测试成功，模型 ${model} 耗时 ${time.toFixed(2)} 秒。',
            )
              .replace('${name}', record.name)
              .replace('${model}', model)
              .replace('${time.toFixed(2)}', time.toFixed(2)),
          );
        }
      } else {
        showError(`${t('模型')} ${model}: ${message}`);
      }
    } catch (error) {
      // 处理网络错误
      const testKey = `${record.id}-${model}`;
      setModelTestResults((prev) => ({
        ...prev,
        [testKey]: {
          success: false,
          message: error.message || t('网络错误'),
          time: 0,
          timestamp: Date.now(),
        },
      }));
      showError(`${t('模型')} ${model}: ${error.message || t('测试失败')}`);
    } finally {
      // 从正在测试的模型集合中移除
      setTestingModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(model);
        return newSet;
      });
    }
  };

  // 批量测试单个渠道的所有模型，参考旧版实现
  const batchTestModels = async () => {
    if (!currentTestChannel || !currentTestChannel.models) {
      showError(t('渠道模型信息不完整'));
      return;
    }

    const models = currentTestChannel.models
      .split(',')
      .filter((model) =>
        model.toLowerCase().includes(modelSearchKeyword.toLowerCase()),
      );

    if (models.length === 0) {
      showError(t('没有找到匹配的模型'));
      return;
    }

    setIsBatchTesting(true);
    shouldStopBatchTestingRef.current = false; // 重置停止标志

    // 清空该渠道之前的测试结果
    setModelTestResults((prev) => {
      const newResults = { ...prev };
      models.forEach((model) => {
        const testKey = `${currentTestChannel.id}-${model}`;
        delete newResults[testKey];
      });
      return newResults;
    });

    try {
      showInfo(
        t('开始批量测试 ${count} 个模型，已清空上次结果...').replace(
          '${count}',
          models.length,
        ),
      );

      // 提高并发数量以加快测试速度，参考旧版的并发限制
      const concurrencyLimit = 5;
      const results = [];

      for (let i = 0; i < models.length; i += concurrencyLimit) {
        // 检查是否应该停止
        if (shouldStopBatchTestingRef.current) {
          showInfo(t('批量测试已停止'));
          break;
        }

        const batch = models.slice(i, i + concurrencyLimit);
        showInfo(
          t('正在测试第 ${current} - ${end} 个模型 (共 ${total} 个)')
            .replace('${current}', i + 1)
            .replace('${end}', Math.min(i + concurrencyLimit, models.length))
            .replace('${total}', models.length),
        );

        const batchPromises = batch.map((model) =>
          testChannel(
            currentTestChannel,
            model,
            selectedEndpointType,
            isStreamTest,
          ),
        );
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // 再次检查是否应该停止
        if (shouldStopBatchTestingRef.current) {
          showInfo(t('批量测试已停止'));
          break;
        }

        // 短暂延迟避免过于频繁的请求
        if (i + concurrencyLimit < models.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!shouldStopBatchTestingRef.current) {
        // 等待一小段时间确保所有结果都已更新
        await new Promise((resolve) => setTimeout(resolve, 300));

        // 使用当前状态重新计算结果统计
        setModelTestResults((currentResults) => {
          let successCount = 0;
          let failCount = 0;

          models.forEach((model) => {
            const testKey = `${currentTestChannel.id}-${model}`;
            const result = currentResults[testKey];
            if (result && result.success) {
              successCount++;
            } else {
              failCount++;
            }
          });

          // 显示完成消息
          setTimeout(() => {
            showSuccess(
              t('批量测试完成！成功: ${success}, 失败: ${fail}, 总计: ${total}')
                .replace('${success}', successCount)
                .replace('${fail}', failCount)
                .replace('${total}', models.length),
            );
          }, 100);

          return currentResults; // 不修改状态，只是为了获取最新值
        });
      }
    } catch (error) {
      showError(t('批量测试过程中发生错误: ') + error.message);
    } finally {
      setIsBatchTesting(false);
    }
  };

  // 停止批量测试
  const stopBatchTesting = () => {
    shouldStopBatchTestingRef.current = true;
    setIsBatchTesting(false);
    setTestingModels(new Set());
    showInfo(t('已停止批量测试'));
  };

  // 清空测试结果
  const clearTestResults = () => {
    setModelTestResults({});
    showInfo(t('已清空测试结果'));
  };

  // Handle close modal
  const handleCloseModal = () => {
    // 如果正在批量测试，先停止测试
    if (isBatchTesting) {
      shouldStopBatchTestingRef.current = true;
      showInfo(t('关闭弹窗，已停止批量测试'));
    }

    setShowModelTestModal(false);
    setModelSearchKeyword('');
    setIsBatchTesting(false);
    setTestingModels(new Set());
    setSelectedModelKeys([]);
    setModelTablePage(1);
    setSelectedEndpointType('');
    setIsStreamTest(false);
    // 可选择性保留测试结果，这里不清空以便用户查看
  };

  // Type counts
  const channelTypeCounts = useMemo(() => {
    if (Object.keys(typeCounts).length > 0) return typeCounts;
    const counts = { all: channels.length };
    channels.forEach((channel) => {
      const collect = (ch) => {
        const type = ch.type;
        counts[type] = (counts[type] || 0) + 1;
      };
      if (channel.children !== undefined) {
        channel.children.forEach(collect);
      } else {
        collect(channel);
      }
    });
    return counts;
  }, [typeCounts, channels]);

  const availableTypeKeys = useMemo(() => {
    const keys = ['all'];
    Object.entries(channelTypeCounts).forEach(([k, v]) => {
      if (k !== 'all' && v > 0) keys.push(String(k));
    });
    return keys;
  }, [channelTypeCounts]);

  return {
    // Basic states
    channels,
    loading,
    searching,
    activePage,
    pageSize,
    channelCount,
    groupOptions,
    idSort,
    enableTagMode,
    enableBatchDelete,
    statusFilter,
    compactMode,
    globalPassThroughEnabled,

    // UI states
    showEdit,
    setShowEdit,
    editingChannel,
    setEditingChannel,
    showEditTag,
    setShowEditTag,
    editingTag,
    setEditingTag,
    selectedChannels,
    selectedChannelRowKeys,
    setSelectedChannels,
    showBatchSetTag,
    setShowBatchSetTag,
    batchSetTagValue,
    setBatchSetTagValue,

    // Column states
    visibleColumns,
    showColumnSelector,
    setShowColumnSelector,
    COLUMN_KEYS,

    // Type tab states
    activeTypeKey,
    setActiveTypeKey,
    typeCounts,
    channelTypeCounts,
    availableTypeKeys,

    // Model test states
    showModelTestModal,
    setShowModelTestModal,
    currentTestChannel,
    setCurrentTestChannel,
    modelSearchKeyword,
    setModelSearchKeyword,
    modelTestResults,
    testingModels,
    selectedModelKeys,
    setSelectedModelKeys,
    isBatchTesting,
    modelTablePage,
    setModelTablePage,
    selectedEndpointType,
    setSelectedEndpointType,
    isStreamTest,
    setIsStreamTest,
    allSelectingRef,

    // Multi-key management states
    showMultiKeyManageModal,
    setShowMultiKeyManageModal,
    currentMultiKeyChannel,
    setCurrentMultiKeyChannel,
    ...upstreamUpdates,

    // Form
    formApi,
    setFormApi,
    formInitValues,

    // Helpers
    t,
    isMobile,

    // Functions
    loadChannels,
    searchChannels,
    refresh,
    manageChannel,
    manageTag,
    handlePageChange,
    handlePageSizeChange,
    copySelectedChannel,
    updateChannelProperty,
    submitTagEdit,
    closeEdit,
    handleRow,
    handleChannelRowSelectionChange,
    batchSetChannelTag,
    batchDeleteChannels,
    testAllChannels,
    deleteAllDisabledChannels,
    updateAllChannelsBalance,
    updateChannelBalance,
    fixChannelsAbilities,
    checkOllamaVersion,
    testChannel,
    batchTestModels,
    handleCloseModal,
    getFormValues,

    // Column functions
    handleColumnVisibilityChange,
    handleSelectAll,
    initDefaultColumns,
    getDefaultColumnVisibility,

    // Setters
    setIdSort,
    setEnableTagMode,
    setEnableBatchDelete,
    setStatusFilter,
    setCompactMode,
    setActivePage,
  };
};
