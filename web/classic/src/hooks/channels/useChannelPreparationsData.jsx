import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  buildGroupOptions,
  showError,
  showSuccess,
  showInfo,
} from '../../helpers';

export const PREPARATION_STATUS = {
  PENDING: 1,
};

export const PREPARATION_STATUS_LABELS = {
  [PREPARATION_STATUS.PENDING]: '待晋升',
};

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_GROUP = 'default';

const toUnixTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return Math.floor(timestamp / 1000);
};

export function useChannelPreparationsData() {
  const { t } = useTranslation();
  const [preparations, setPreparations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [preparationStats, setPreparationStats] = useState({
    balance_total: 0,
  });
  const [groupOptions, setGroupOptions] = useState([
    { label: DEFAULT_GROUP, value: DEFAULT_GROUP },
  ]);
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [dateRange, setDateRange] = useState([]);
  const [type, setType] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [selectedPreparationKeys, setSelectedPreparationKeys] = useState([]);
  const [selectedPreparations, setSelectedPreparations] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingPreparation, setEditingPreparation] = useState(null);

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
  const allSelectingRef = useRef(false);
  const shouldStopBatchTestingRef = useRef(false);

  const loadPreparations = useCallback(
    async (page = activePage, size = pageSize) => {
      setLoading(true);
      try {
        const params = {
          p: page,
          page_size: size,
          keyword,
          group,
        };
        if (Array.isArray(dateRange) && dateRange.length === 2) {
          const startTimestamp = toUnixTimestamp(dateRange[0]);
          const endTimestamp = toUnixTimestamp(dateRange[1]);
          if (startTimestamp !== null) params.start_timestamp = startTimestamp;
          if (endTimestamp !== null) params.end_timestamp = endTimestamp;
        }
        if (type !== undefined && type !== null && type !== '')
          params.type = type;
        if (status !== undefined && status !== null && status !== '')
          params.status = status;
        const res = await API.get('/api/channel/preparations', { params });
        const { success, data, message } = res.data;
        if (!success) {
          showError(message || t('加载失败'));
          return;
        }
        setPreparations(data?.items || []);
        setSelectedPreparationKeys([]);
        setSelectedPreparations([]);
        setTotal(data?.total || 0);
        setPreparationStats(data?.stats || { balance_total: 0 });
        setActivePage(data?.page || page);
        setPageSize(data?.page_size || size);
      } catch (error) {
        showError(error.message || t('加载失败'));
      } finally {
        setLoading(false);
      }
    },
    [activePage, pageSize, keyword, group, dateRange, type, status, t],
  );

  const refresh = useCallback(
    () => loadPreparations(activePage, pageSize),
    [loadPreparations, activePage, pageSize],
  );

  useEffect(() => {
    loadPreparations(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    API.get('/api/group/', { skipErrorHandler: true })
      .then((res) => {
        if (res?.data?.success) {
          setGroupOptions(buildGroupOptions(res.data.data, DEFAULT_GROUP));
        }
      })
      .catch(() => {
        setGroupOptions([{ label: DEFAULT_GROUP, value: DEFAULT_GROUP }]);
      });
  }, []);

  const handleSearch = useCallback(() => {
    setActivePage(1);
    loadPreparations(1, pageSize);
  }, [loadPreparations, pageSize]);

  const handlePageChange = useCallback(
    (page) => {
      setActivePage(page);
      loadPreparations(page, pageSize);
    },
    [loadPreparations, pageSize],
  );

  const handlePageSizeChange = useCallback(
    (size) => {
      setPageSize(size);
      setActivePage(1);
      loadPreparations(1, size);
    },
    [loadPreparations],
  );

  const openCreate = useCallback(() => {
    setEditingPreparation(null);
    setShowEdit(true);
  }, []);

  const openEdit = useCallback((preparation) => {
    setEditingPreparation(preparation);
    setShowEdit(true);
  }, []);

  const closeEdit = useCallback(() => {
    setShowEdit(false);
    setEditingPreparation(null);
  }, []);

  const savePreparation = useCallback(
    async (payload) => {
      const isEdit = Boolean(payload.id);
      const res = isEdit
        ? await API.put(`/api/channel/preparations/${payload.id}`, payload)
        : await API.post('/api/channel/preparations', payload);
      if (!res.data.success) {
        throw new Error(res.data.message || t('保存失败'));
      }
      showSuccess(isEdit ? t('候选渠道更新成功') : t('候选渠道创建成功'));
      closeEdit();
      refresh();
      return res.data.data;
    },
    [closeEdit, refresh, t],
  );

  const importPreparations = useCallback(
    async (items) => {
      const res = await API.post('/api/channel/preparations/import', { items });
      if (!res.data.success) {
        throw new Error(res.data.message || t('导入失败'));
      }
      const results = res.data.data?.results || [];
      const successCount = results.filter((item) => item.ok).length;
      showSuccess(t('导入完成：{{count}} 条成功', { count: successCount }));
      refresh();
      return results;
    },
    [refresh, t],
  );

  const testPreparation = useCallback(
    async (preparation, model = '', endpointType = '', stream = false) => {
      const testKey = `${preparation.id}-${model}`;
      if (shouldStopBatchTestingRef.current && isBatchTesting) {
        return false;
      }
      setTestingModels((prev) => new Set([...prev, model]));

      try {
        const params = new URLSearchParams();
        if (model) params.set('model', model);
        if (endpointType) params.set('endpoint_type', endpointType);
        if (stream) params.set('stream', 'true');
        const query = params.toString();
        const res = await API.get(
          `/api/channel/preparations/${preparation.id}/test${query ? `?${query}` : ''}`,
        );

        if (shouldStopBatchTestingRef.current && isBatchTesting) {
          return false;
        }

        const { success, message, time, error_code } = res.data;
        setModelTestResults((prev) => ({
          ...prev,
          [testKey]: {
            success,
            message,
            time: time || 0,
            timestamp: Date.now(),
            errorCode: error_code || null,
          },
        }));

        if (success) {
          setPreparations((prev) =>
            prev.map((item) =>
              item.id === preparation.id
                ? {
                    ...item,
                    response_time: time * 1000,
                    test_time: Date.now() / 1000,
                  }
                : item,
            ),
          );
          if (model) {
            showInfo(
              t(
                '候选渠道 ${name} 测试成功，模型 ${model} 耗时 ${time.toFixed(2)} 秒。',
              )
                .replace('${name}', preparation.name)
                .replace('${model}', model)
                .replace('${time.toFixed(2)}', time.toFixed(2)),
            );
          } else {
            showInfo(
              t('候选渠道 ${name} 测试成功，耗时 ${time.toFixed(2)} 秒。')
                .replace('${name}', preparation.name)
                .replace('${time.toFixed(2)}', time.toFixed(2)),
            );
          }
          return true;
        }
        showError(message || t('测试失败'));
        return false;
      } catch (error) {
        setModelTestResults((prev) => ({
          ...prev,
          [testKey]: {
            success: false,
            message:
              error?.response?.data?.message || error.message || t('网络错误'),
            time: 0,
            timestamp: Date.now(),
            errorCode: null,
          },
        }));
        showError(error?.response?.data?.message || error.message || t('测试失败'));
        return false;
      } finally {
        setTestingModels((prev) => {
          const next = new Set(prev);
          next.delete(model);
          return next;
        });
      }
    },
    [isBatchTesting, t],
  );

  const batchTestModels = useCallback(async () => {
    if (!currentTestChannel || !currentTestChannel.models) {
      showError(t('渠道模型信息不完整'));
      return;
    }

    const models = currentTestChannel.models
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean)
      .filter((model) =>
        model.toLowerCase().includes(modelSearchKeyword.toLowerCase()),
      );

    if (models.length === 0) {
      showError(t('没有找到匹配的模型'));
      return;
    }

    setIsBatchTesting(true);
    shouldStopBatchTestingRef.current = false;
    setModelTestResults((prev) => {
      const next = { ...prev };
      models.forEach((model) => {
        delete next[`${currentTestChannel.id}-${model}`];
      });
      return next;
    });

    try {
      showInfo(
        t('开始批量测试 ${count} 个模型，已清空上次结果...').replace(
          '${count}',
          models.length,
        ),
      );
      const concurrencyLimit = 5;
      for (let i = 0; i < models.length; i += concurrencyLimit) {
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
        await Promise.allSettled(
          batch.map((model) =>
            testPreparation(
              currentTestChannel,
              model,
              selectedEndpointType,
              isStreamTest,
            ),
          ),
        );
        if (i + concurrencyLimit < models.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!shouldStopBatchTestingRef.current) {
        setModelTestResults((currentResults) => {
          let successCount = 0;
          let failCount = 0;
          models.forEach((model) => {
            const result = currentResults[`${currentTestChannel.id}-${model}`];
            if (result && result.success) successCount += 1;
            else failCount += 1;
          });
          setTimeout(() => {
            showSuccess(
              t('批量测试完成！成功: ${success}, 失败: ${fail}, 总计: ${total}')
                .replace('${success}', successCount)
                .replace('${fail}', failCount)
                .replace('${total}', models.length),
            );
          }, 100);
          return currentResults;
        });
      }
    } catch (error) {
      showError(t('批量测试过程中发生错误: ') + error.message);
    } finally {
      setIsBatchTesting(false);
    }
  }, [
    currentTestChannel,
    isStreamTest,
    modelSearchKeyword,
    selectedEndpointType,
    t,
    testPreparation,
  ]);

  const handleCloseModal = useCallback(() => {
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
  }, [isBatchTesting, t]);

  const promotePreparation = useCallback(
    async (preparation) => {
      const res = await API.post(
        `/api/channel/preparations/${preparation.id}/promote`,
      );
      if (!res.data.success) {
        showError(res.data.message || t('晋升失败'));
        return false;
      }
      showSuccess(t('候选渠道已晋升为正式渠道，并已从备货池移除'));
      refresh();
      return true;
    },
    [refresh, t],
  );

  const promoteSelected = useCallback(async () => {
    const ids = selectedPreparations.map((item) => item.id);
    if (ids.length === 0) {
      showInfo(t('请先选择候选渠道'));
      return;
    }
    const res = await API.post('/api/channel/preparations/batch/promote', {
      ids,
    });
    if (!res.data.success) {
      showError(res.data.message || t('批量晋升失败'));
      return;
    }
    const results = res.data.data?.results || [];
    const successCount = results.filter((item) => item.ok).length;
    showSuccess(t('批量晋升完成：{{count}} 条成功', { count: successCount }));
    setSelectedPreparationKeys([]);
    setSelectedPreparations([]);
    refresh();
  }, [selectedPreparations, refresh, t]);

  const deletePreparation = useCallback(
    async (preparation) => {
      const res = await API.delete(
        `/api/channel/preparations/${preparation.id}`,
      );
      if (!res.data.success) {
        showError(res.data.message || t('删除失败'));
        return false;
      }
      showSuccess(t('候选渠道已删除'));
      refresh();
      return true;
    },
    [refresh, t],
  );

  const deleteSelected = useCallback(async () => {
    if (selectedPreparations.length === 0) {
      showInfo(t('请先选择候选渠道'));
      return;
    }
    let successCount = 0;
    for (const item of selectedPreparations) {
      const res = await API.delete(`/api/channel/preparations/${item.id}`);
      if (res.data.success) successCount += 1;
    }
    showSuccess(t('批量删除完成：{{count}} 条成功', { count: successCount }));
    setSelectedPreparationKeys([]);
    setSelectedPreparations([]);
    refresh();
  }, [selectedPreparations, refresh, t]);

  return useMemo(
    () => ({
      t,
      preparations,
      loading,
      activePage,
      pageSize,
      total,
      preparationStats,
      groupOptions,
      keyword,
      setKeyword,
      group,
      setGroup,
      dateRange,
      setDateRange,
      type,
      setType,
      status,
      setStatus,
      selectedPreparationKeys,
      setSelectedPreparationKeys,
      selectedPreparations,
      setSelectedPreparations,
      showEdit,
      showImport,
      setShowImport,
      editingPreparation,
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
      refresh,
      handleSearch,
      handlePageChange,
      handlePageSizeChange,
      openCreate,
      openEdit,
      closeEdit,
      savePreparation,
      importPreparations,
      testPreparation,
      batchTestModels,
      handleCloseModal,
      promotePreparation,
      promoteSelected,
      deletePreparation,
      deleteSelected,
    }),
    [
      t,
      preparations,
      loading,
      activePage,
      pageSize,
      total,
      preparationStats,
      groupOptions,
      keyword,
      group,
      dateRange,
      type,
      status,
      selectedPreparationKeys,
      selectedPreparations,
      showEdit,
      showImport,
      editingPreparation,
      showModelTestModal,
      currentTestChannel,
      modelSearchKeyword,
      modelTestResults,
      testingModels,
      selectedModelKeys,
      isBatchTesting,
      modelTablePage,
      selectedEndpointType,
      isStreamTest,
      refresh,
      handleSearch,
      handlePageChange,
      handlePageSizeChange,
      openCreate,
      openEdit,
      closeEdit,
      savePreparation,
      importPreparations,
      testPreparation,
      batchTestModels,
      handleCloseModal,
      promotePreparation,
      promoteSelected,
      deletePreparation,
      deleteSelected,
    ],
  );
}
