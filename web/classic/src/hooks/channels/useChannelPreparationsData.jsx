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

export const PREPARATION_TEST_STATUS = {
  UNTESTED: 0,
  SUCCESS: 1,
  FAILED: 2,
};

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_GROUP = 'default';
export const DEFAULT_BATCH_TEST_MODEL = '';

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
  const shouldStopPreparationBatchTestingRef = useRef(false);
  const [testingPreparationIds, setTestingPreparationIds] = useState(new Set());
  const [isPreparationBatchTesting, setIsPreparationBatchTesting] = useState(false);
  const [preparationBatchProgress, setPreparationBatchProgress] = useState({
    total: 0,
    finished: 0,
    success: 0,
    fail: 0,
  });

  const buildListParams = useCallback(
    (page, size, overrides = {}) => {
      const filter = {
        keyword,
        group,
        dateRange,
        type,
        status,
        ...overrides,
      };
      const params = {
        p: page,
        page_size: size,
        keyword: filter.keyword,
        group: filter.group,
      };
      if (Array.isArray(filter.dateRange) && filter.dateRange.length === 2) {
        const startTimestamp = toUnixTimestamp(filter.dateRange[0]);
        const endTimestamp = toUnixTimestamp(filter.dateRange[1]);
        if (startTimestamp !== null) params.start_timestamp = startTimestamp;
        if (endTimestamp !== null) params.end_timestamp = endTimestamp;
      }
      if (filter.type !== undefined && filter.type !== null && filter.type !== '') {
        params.type = filter.type;
      }
      if (
        filter.status !== undefined &&
        filter.status !== null &&
        filter.status !== ''
      ) {
        params.status = filter.status;
      }
      return params;
    },
    [keyword, group, dateRange, type, status],
  );

  const loadPreparations = useCallback(
    async (page = activePage, size = pageSize) => {
      setLoading(true);
      try {
        const params = buildListParams(page, size);
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
    [activePage, pageSize, buildListParams, t],
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
      const failedResults = results.filter((item) => !item.ok);
      showSuccess(t('导入完成：{{count}} 条成功', { count: successCount }));
      if (failedResults.length > 0) {
        showError(
          t('导入失败 {{count}} 条：{{details}}')
            .replace('{{count}}', failedResults.length)
            .replace(
              '{{details}}',
              failedResults
                .slice(0, 5)
                .map((item) => `#${Number(item.index) + 1} ${item.error}`)
                .join('；'),
            ),
        );
      }
      refresh();
      return results;
    },
    [refresh, t],
  );

  const testPreparation = useCallback(
    async (
      preparation,
      model = '',
      endpointType = '',
      stream = false,
      options = {},
    ) => {
      const testKey = `${preparation.id}-${model}`;
      const silent = options.silent === true;
      if (shouldStopBatchTestingRef.current && isBatchTesting) {
        return false;
      }
      setTestingModels((prev) => new Set([...prev, model]));
      setTestingPreparationIds((prev) => new Set([...prev, preparation.id]));

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

        const updateTestResult = (testStatus, testMessage = '') => {
          setPreparations((prev) =>
            prev.map((item) =>
              item.id === preparation.id
                ? {
                    ...item,
                    response_time: (time || 0) * 1000,
                    test_time: Date.now() / 1000,
                    test_status: testStatus,
                    test_message: testMessage,
                  }
                : item,
            ),
          );
        };

        if (success) {
          updateTestResult(PREPARATION_TEST_STATUS.SUCCESS, '');
          if (!silent) {
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
          }
          return true;
        }
        updateTestResult(PREPARATION_TEST_STATUS.FAILED, message || t('测试失败'));
        if (!silent) showError(message || t('测试失败'));
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
        const errorMessage =
          error?.response?.data?.message || error.message || t('测试失败');
        setPreparations((prev) =>
          prev.map((item) =>
            item.id === preparation.id
              ? {
                  ...item,
                  test_time: Date.now() / 1000,
                  test_status: PREPARATION_TEST_STATUS.FAILED,
                  test_message: errorMessage,
                }
              : item,
          ),
        );
        if (!silent) showError(errorMessage);
        return false;
      } finally {
        setTestingModels((prev) => {
          const next = new Set(prev);
          next.delete(model);
          return next;
        });
        setTestingPreparationIds((prev) => {
          const next = new Set(prev);
          next.delete(preparation.id);
          return next;
        });
      }
    },
    [isBatchTesting, t],
  );

  const fetchPreparationsForBatchTest = useCallback(
    async (scope) => {
      if (scope === 'selected') {
        return selectedPreparations.filter(
          (item) => item.status === PREPARATION_STATUS.PENDING,
        );
      }

      const size = 100;
      let page = 1;
      let totalCount = 0;
      const items = [];
      const filterOverrides =
        scope === 'all'
          ? {
              keyword: '',
              group: '',
              dateRange: [],
              type: undefined,
              status: PREPARATION_STATUS.PENDING,
            }
          : {};

      do {
        const params = buildListParams(page, size, filterOverrides);
        const res = await API.get('/api/channel/preparations', { params });
        const { success, data, message } = res.data;
        if (!success) {
          throw new Error(message || t('加载失败'));
        }
        const pageItems = data?.items || [];
        items.push(
          ...pageItems.filter((item) => item.status === PREPARATION_STATUS.PENDING),
        );
        totalCount = data?.total || 0;
        if (pageItems.length === 0 || page * size >= totalCount) break;
        page += 1;
      } while (page <= 1000);

      return items;
    },
    [buildListParams, selectedPreparations, t],
  );

  const batchTestPreparations = useCallback(
    async (scope) => {
      if (isPreparationBatchTesting) {
        showInfo(t('批量测试正在进行中'));
        return;
      }

      try {
        const targets = await fetchPreparationsForBatchTest(scope);
        if (targets.length === 0) {
          showInfo(t('没有可测试的候选渠道'));
          return;
        }

        shouldStopPreparationBatchTestingRef.current = false;
        setIsPreparationBatchTesting(true);
        setPreparationBatchProgress({
          total: targets.length,
          finished: 0,
          success: 0,
          fail: 0,
        });
        showInfo(t('开始批量测试 {{count}} 个候选渠道', { count: targets.length }));

        const concurrencyLimit = 5;
        let successCount = 0;
        let failCount = 0;
        let finishedCount = 0;

        for (let i = 0; i < targets.length; i += concurrencyLimit) {
          if (shouldStopPreparationBatchTestingRef.current) break;
          const batch = targets.slice(i, i + concurrencyLimit);
          const results = await Promise.allSettled(
            batch.map((item) =>
              testPreparation(item, DEFAULT_BATCH_TEST_MODEL, '', false, {
                silent: true,
              }),
            ),
          );
          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) successCount += 1;
            else failCount += 1;
          });
          finishedCount += batch.length;
          setPreparationBatchProgress({
            total: targets.length,
            finished: finishedCount,
            success: successCount,
            fail: failCount,
          });
          if (i + concurrencyLimit < targets.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        if (shouldStopPreparationBatchTestingRef.current) {
          showInfo(
            t('批量测试已停止：成功 {{success}}，失败 {{fail}}', {
              success: successCount,
              fail: failCount,
            }),
          );
        } else {
          showSuccess(
            t('批量测试完成：成功 {{success}}，失败 {{fail}}', {
              success: successCount,
              fail: failCount,
            }),
          );
        }
        refresh();
      } catch (error) {
        showError(error.message || t('批量测试失败'));
      } finally {
        setIsPreparationBatchTesting(false);
      }
    },
    [
      fetchPreparationsForBatchTest,
      isPreparationBatchTesting,
      refresh,
      t,
      testPreparation,
    ],
  );

  const stopPreparationBatchTest = useCallback(() => {
    shouldStopPreparationBatchTestingRef.current = true;
    showInfo(t('正在停止批量测试'));
  }, [t]);

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
      testingPreparationIds,
      isPreparationBatchTesting,
      preparationBatchProgress,
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
      batchTestPreparations,
      stopPreparationBatchTest,
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
      testingPreparationIds,
      isPreparationBatchTesting,
      preparationBatchProgress,
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
      batchTestPreparations,
      stopPreparationBatchTest,
      batchTestModels,
      handleCloseModal,
      promotePreparation,
      promoteSelected,
      deletePreparation,
      deleteSelected,
    ],
  );
}
