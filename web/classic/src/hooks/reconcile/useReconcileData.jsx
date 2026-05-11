/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

// Default date range: this month so far — matches the usage-logs default and
// shows the freshest aggregated data on first visit. The "上个月" preset
// button switches to the previous calendar month for the typical month-end
// reconciliation workflow.
const defaultDateRange = () => {
  return [dayjs().startOf('month').toDate(), dayjs().endOf('day').toDate()];
};

// dateTimeRange picks return Date objects with full minute/second precision,
// so we honour them exactly (no startOf('day')/endOf('day') coercion).
const dateToUnix = (d) => {
  if (!d) return 0;
  const dj = dayjs(d);
  if (!dj.isValid()) return 0;
  return dj.unix();
};

export const useReconcileData = () => {
  const { t } = useTranslation();
  const [compactMode, setCompactMode] = useTableCompactMode('reconcile');

  // Reference data
  const [channels, setChannels] = useState([]); // [{id, name}]

  // Table state
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stat, setStat] = useState({ filtered_amount_cny: 0 });

  // Form state
  const initRange = defaultDateRange();
  const formInitValues = {
    dateRange: initRange,
    channelId: undefined, // undefined = all channels
    modelName: '',
  };
  const formApiRef = useRef(null);
  const setFormApi = (api) => {
    formApiRef.current = api;
  };

  // Channel name cache for the export filename + table display.
  const channelNameById = (id) =>
    channels.find((c) => c.id === id)?.name || `#${id}`;

  // Read current form filter values, falling back to defaults.
  const readFilter = () => {
    const v = formApiRef.current?.getValues?.() ?? {};
    const dateRange = v.dateRange ?? initRange;
    return {
      channelId: v.channelId || 0, // 0 means all channels
      fromUnix: dateToUnix(dateRange?.[0]),
      toUnix: dateToUnix(dateRange?.[1]),
      modelName: v.modelName || '',
    };
  };

  const loadChannels = async () => {
    try {
      const res = await API.get('/api/channel/?p=0&page_size=1000');
      const { success, data } = res.data || {};
      const items = success
        ? Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : []
        : [];
      setChannels(items.map((c) => ({ id: c.id, name: c.name || `#${c.id}` })));
    } catch (e) {
      // Channel picker stays empty if the request fails
    }
  };

  const loadData = async (page = activePage, size = pageSize) => {
    setLoading(true);
    try {
      const f = readFilter();
      const params = new URLSearchParams({
        from: String(f.fromUnix),
        to: String(f.toUnix),
        page: String(page),
        page_size: String(size),
      });
      if (f.channelId) params.set('channel_id', String(f.channelId));
      if (f.modelName) params.set('model_name', f.modelName);
      const res = await API.get(`/api/reconcile/admin/list?${params}`);
      const { success, message, data, total: total0, stat: stat0 } = res.data || {};
      if (success) {
        setRows(
          (data || []).map((r, idx) => ({
            ...r,
            key: `${r.id ?? idx}`,
          })),
        );
        setTotal(total0 || 0);
        setStat({
          filtered_amount_cny: stat0?.filtered_amount_cny ?? 0,
        });
      } else {
        showError(message || t('查询失败'));
      }
    } catch (e) {
      showError(t('查询失败'));
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setActivePage(1);
    loadData(1, pageSize);
  };

  const resetFilter = () => {
    formApiRef.current?.reset?.();
    setActivePage(1);
    setTimeout(() => loadData(1, pageSize), 100);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadData(page, pageSize);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    loadData(1, size);
  };

  // Export — backend wants channel_id + month=YYYY-MM. We use the start of the
  // current dateRange as the month indicator; if the range spans multiple
  // months the admin should narrow first.
  const exportMonth = async () => {
    const f = readFilter();
    if (!f.fromUnix) {
      showError(t('请选择月份'));
      return;
    }
    const startMonth = dayjs.unix(f.fromUnix).format('YYYY-MM');
    setExporting(true);
    try {
      const params = {
        month: startMonth,
        format: 'xlsx',
      };
      if (f.channelId) params.channel_id = f.channelId;
      if (f.modelName) params.model_name = f.modelName;
      const res = await API.get('/api/reconcile/admin/export', {
        params,
        responseType: 'blob',
      });
      if (
        res.data?.type &&
        (res.data.type.includes('application/json') ||
          res.data.type === '')
      ) {
        const text = await res.data.text();
        showError(text || t('导出失败'));
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(res.data);
      link.download = `reconcile_${startMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      showSuccess(t('导出成功'));
    } catch (e) {
      showError(t('导出失败'));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadChannels();
      // initial load with default last-month filter
      await loadData(1, pageSize);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // data
    rows,
    total,
    loading,
    channels,
    stat,

    // pagination
    activePage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,

    // form
    formInitValues,
    setFormApi,
    refresh,
    resetFilter,

    // export
    exportMonth,
    exporting,

    // ui
    compactMode,
    setCompactMode,

    t,
  };
};
