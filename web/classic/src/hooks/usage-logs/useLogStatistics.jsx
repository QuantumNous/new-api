/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) by the user, there is NO WARRANTY.
For commercial licensing, please contact support@quantumnous.com
*/

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  renderQuota,
  renderNumber,
  modelColorMap,
  modelToColor,
  getQuotaWithUnit,
  showError,
  timestamp2string,
  getTodayStartTimestamp,
} from '../../helpers';

export const useLogStatistics = () => {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [trend, setTrend] = useState([]);

  // Form defaults
  const now = new Date();
  const formInitValues = {
    username: '',
    token_name: '',
    model_name: '',
    dateRange: [
      timestamp2string(getTodayStartTimestamp()),
      timestamp2string(now.getTime() / 1000 + 3600),
    ],
  };

  const [formApi, setFormApi] = useState(null);

  const getFormParams = useCallback(() => {
    if (!formApi) return null;
    const values = formApi.getValues();
    const username = values.username || '';
    if (!username) return null;

    let start_timestamp = '';
    let end_timestamp = '';
    if (values.dateRange && Array.isArray(values.dateRange) && values.dateRange.length === 2) {
      const toTimestamp = (v) => {
        if (v instanceof Date) return v.getTime() / 1000;
        if (typeof v === 'string' && v) return Date.parse(v) / 1000;
        return 0;
      };
      start_timestamp = toTimestamp(values.dateRange[0]);
      end_timestamp = toTimestamp(values.dateRange[1]);
    }
    return {
      username,
      token_name: values.token_name || '',
      model_name: values.model_name || '',
      start_timestamp,
      end_timestamp,
    };
  }, [formApi]);

  const fetchStatistics = useCallback(async () => {
    const params = getFormParams();
    if (!params) {
      showError(t('请输入用户名'));
      return;
    }
    setLoading(true);
    try {
      const url = `/api/log/statistics?username=${encodeURIComponent(params.username)}&token_name=${encodeURIComponent(params.token_name)}&model_name=${encodeURIComponent(params.model_name)}&start_timestamp=${params.start_timestamp}&end_timestamp=${params.end_timestamp}`;
      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        setStatistics(data.models || []);
        setTrend(data.trend || []);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getFormParams, t]);

  const exportExcel = useCallback(async () => {
    const params = getFormParams();
    if (!params) return;
    setExportLoading(true);
    try {
      const url = `/api/log/statistics/export?username=${encodeURIComponent(params.username)}&token_name=${encodeURIComponent(params.token_name)}&model_name=${encodeURIComponent(params.model_name)}&start_timestamp=${params.start_timestamp}&end_timestamp=${params.end_timestamp}`;
      const res = await API.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const contentDisposition = res.headers['content-disposition'];
      let filename = `usage_statistics_${params.username}.xlsx`;
      if (contentDisposition) {
        // Prefer filename*=UTF-8''... (RFC 5987), fall back to filename="..."
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
        if (utf8Match) {
          filename = decodeURIComponent(utf8Match[1]);
        } else {
          const match = contentDisposition.match(/filename="?([^";]+)"?/);
          if (match) filename = decodeURIComponent(match[1]);
        }
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      showError(t('导出失败'));
    } finally {
      setExportLoading(false);
    }
  }, [getFormParams, t]);

  // Build VChart specs from data
  const buildBarSpec = useCallback(() => {
    if (!statistics || statistics.length === 0) return null;
    const colors = {};
    statistics.forEach((m) => {
      colors[m.model_name] = modelColorMap[m.model_name] || modelToColor(m.model_name);
    });
    return {
      type: 'bar',
      data: [{ id: 'barData', values: statistics.map((m) => ({
        Model: m.model_name,
        Count: m.request_count,
      }))}],
      xField: 'Model',
      yField: 'Count',
      seriesField: 'Model',
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('模型调用次数分布'),
        subtext: `${t('总计')}：${renderNumber(statistics.reduce((s, m) => s + m.request_count, 0))}`,
      },
      bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
      tooltip: {
        mark: { content: [{ key: (d) => d['Model'], value: (d) => renderNumber(d['Count']) }] },
      },
      color: { specified: colors },
    };
  }, [statistics, t]);

  const buildTrendSpec = useCallback(() => {
    if (!trend || trend.length === 0) return null;
    const models = [...new Set(trend.map((t) => t.model_name))];
    const colors = {};
    models.forEach((m) => {
      colors[m] = modelColorMap[m] || modelToColor(m);
    });
    return {
      type: 'line',
      data: [{ id: 'trendData', values: trend.map((t) => ({
        Time: t.time,
        Model: t.model_name,
        Count: t.request_count,
      }))}],
      xField: 'Time',
      yField: 'Count',
      seriesField: 'Model',
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('调用趋势'),
        subtext: '',
      },
      tooltip: {
        mark: { content: [{ key: (d) => d['Model'], value: (d) => renderNumber(d['Count']) }] },
      },
      color: { specified: colors },
    };
  }, [trend, t]);

  const buildQuotaBarSpec = useCallback(() => {
    if (!statistics || statistics.length === 0) return null;
    const colors = {};
    statistics.forEach((m) => {
      colors[m.model_name] = modelColorMap[m.model_name] || modelToColor(m.model_name);
    });
    return {
      type: 'bar',
      data: [{ id: 'quotaData', values: statistics.map((m) => ({
        Model: m.model_name,
        rawQuota: m.quota,
        Usage: m.quota ? getQuotaWithUnit(m.quota, 4) : 0,
      }))}],
      xField: 'Model',
      yField: 'Usage',
      seriesField: 'Model',
      stack: false,
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('模型消耗分布'),
        subtext: `${t('总计')}：${renderQuota(statistics.reduce((s, m) => s + m.quota, 0), 2)}`,
      },
      bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
      tooltip: {
        mark: { content: [{ key: (d) => d['Model'], value: (d) => renderQuota(d['rawQuota'] || 0, 4) }] },
      },
      color: { specified: colors },
    };
  }, [statistics, t]);

  return {
    visible,
    setVisible,
    loading,
    exportLoading,
    statistics,
    trend,
    formInitValues,
    setFormApi,
    fetchStatistics,
    exportExcel,
    buildBarSpec,
    buildTrendSpec,
    buildQuotaBarSpec,
    t,
  };
};
