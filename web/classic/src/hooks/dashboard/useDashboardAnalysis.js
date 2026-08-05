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

import { useCallback, useEffect, useRef, useState } from 'react';
import { API, showError, showSuccess } from '../../helpers';
import { getQuotaPerUnit } from '../../helpers/quota';
import { buildDashboardAnalysisCsv } from './analysisCsv';
import {
  emptyDashboardAnalysis,
  getAnalysisFailureMessage,
  isAnalysisRequestCurrent,
  isRequestCanceled,
  runDashboardAnalysisRequest,
} from './analysisState';
import { parseDashboardDateRange } from './time';
import { describeDashboardRangeError, validateDashboardRange } from './range';

export const ADMIN_ANALYSIS_DIMENSIONS = ['period', 'model_name'];
export const USER_ANALYSIS_DIMENSIONS = ['period', 'model_name'];
export const ANALYSIS_FALLBACK_DIMENSIONS = ['period'];

export const useDashboardAnalysis = (inputs, isAdminUser, t) => {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const defaultDimensions = isAdminUser
    ? ADMIN_ANALYSIS_DIMENSIONS
    : USER_ANALYSIS_DIMENSIONS;
  const [analysis, setAnalysis] = useState(() =>
    emptyDashboardAnalysis(defaultDimensions),
  );
  const requestGeneration = useRef(0);
  const abortController = useRef(null);

  const buildQuery = useCallback(
    (dimensions) => {
      const { start, end } = parseDashboardDateRange(
        inputs.start_timestamp,
        inputs.end_timestamp,
      );
      // Enforce the shared bound client side so an unusable selection reports
      // the precise reason instead of a generic request failure.
      const rangeError = validateDashboardRange(start, end);
      if (rangeError) return { rangeError };
      const params = new URLSearchParams({
        start_timestamp: String(start),
        end_timestamp: String(end),
        granularity:
          inputs.data_export_default_time === 'hour' ? 'hour' : 'day',
        dimensions: dimensions.join(','),
      });
      ['token_name', 'model_name', 'group'].forEach((field) => {
        if (inputs[field]) params.set(field, inputs[field]);
      });
      if (isAdminUser) {
        if (inputs.username) params.set('username', inputs.username);
        if (inputs.channel) params.set('channel', inputs.channel);
      }
      return { params };
    },
    [inputs, isAdminUser],
  );

  const requestAnalysis = useCallback(
    async (dimensions, signal) => {
      const { params: query, rangeError } = buildQuery(dimensions);
      if (rangeError) {
        return {
          success: false,
          code: rangeError,
          message: describeDashboardRangeError(rangeError, t),
        };
      }
      const path = isAdminUser ? '/api/log/analysis' : '/api/log/self/analysis';
      try {
        const res = await API.get(`${path}?${query.toString()}`, {
          signal,
          // Dashboard analysis owns its error presentation so a failed
          // fallback can show the exact server response rather than a second
          // generic interceptor toast.
          skipErrorHandler: true,
          disableDuplicate: true,
        });
        return res.data || { success: false, message: t('分析响应为空') };
      } catch (error) {
        if (isRequestCanceled(error, signal)) {
          return { success: false, canceled: true };
        }
        const payload = error?.response?.data || {};
        return {
          success: false,
          code: payload.code,
          status: error?.response?.status,
          message: getAnalysisFailureMessage(error, t('加载消费分析失败')),
        };
      }
    },
    [buildQuery, isAdminUser, t],
  );

  const reload = useCallback(async () => {
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    const isCurrent = () =>
      isAnalysisRequestCurrent(
        generation,
        requestGeneration.current,
        controller.signal,
      );
    const clearAnalysis = () => {
      setAnalysis(emptyDashboardAnalysis(defaultDimensions));
      setNotice('');
    };

    setLoading(true);
    setError('');
    setNotice('');
    // Invalidate the previous financial result before starting a new query.
    // This also makes export unavailable while the new filter is loading.
    setAnalysis(emptyDashboardAnalysis(defaultDimensions));
    try {
      await runDashboardAnalysisRequest({
        defaultDimensions,
        fallbackDimensions: ANALYSIS_FALLBACK_DIMENSIONS,
        signal: controller.signal,
        requestAnalysis,
        isCurrent,
        defaultFailureMessage: t('加载消费分析失败'),
        fallbackNotice: t(
          '结果超过 5000 个分组，已自动降级为仅按时间分组；如需明细，请缩小筛选范围或降低时间粒度。',
        ),
        setAnalysis,
        setNotice,
        setError,
        showError,
      });
    } catch (error) {
      if (!isCurrent() || isRequestCanceled(error, controller.signal)) return;
      const requestMessage = `${t('加载消费分析失败')}: ${error?.message || ''}`;
      clearAnalysis();
      setError(requestMessage);
      showError(requestMessage);
    } finally {
      if (isCurrent()) {
        setLoading(false);
        abortController.current = null;
      }
    }
  }, [defaultDimensions, isAdminUser, requestAnalysis, t]);

  const exportAnalysis = useCallback(() => {
    const rows = analysis.rows || [];
    if (!rows.length) {
      showError(t('当前筛选条件下没有消费记录'));
      return;
    }
    const quotaPerUnit = getQuotaPerUnit() || 500000;
    const csv = buildDashboardAnalysisCsv({
      rows,
      isAdminUser,
      dimensions: analysis.dimensions,
      t,
      quotaPerUnit,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aibuff-dashboard-${isAdminUser ? 'admin' : 'self'}-${String(
      inputs.start_timestamp,
    )
      .slice(0, 10)
      .replaceAll('-', '')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showSuccess(t('消费分析导出成功'));
  }, [
    analysis.dimensions,
    analysis.rows,
    inputs.start_timestamp,
    isAdminUser,
    t,
  ]);

  // SearchModal edits are intentionally staged; the query is reloaded only
  // after the user confirms, avoiding a request per keystroke.
  useEffect(() => {
    void reload();
    return () => {
      requestGeneration.current += 1;
      abortController.current?.abort();
      abortController.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminUser]);

  return { analysis, loading, notice, error, reload, exportAnalysis };
};
