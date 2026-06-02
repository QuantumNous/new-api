import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showInfo } from '../../helpers';

export const PREPARATION_STATUS = {
  PENDING: 1,
  PROMOTED: 2,
  ARCHIVED: 3,
};

export const PREPARATION_STATUS_LABELS = {
  [PREPARATION_STATUS.PENDING]: '待晋升',
  [PREPARATION_STATUS.PROMOTED]: '已晋升',
  [PREPARATION_STATUS.ARCHIVED]: '已归档',
};

const DEFAULT_PAGE_SIZE = 20;

export function useChannelPreparationsData() {
  const { t } = useTranslation();
  const [preparations, setPreparations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [type, setType] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [selectedPreparationKeys, setSelectedPreparationKeys] = useState([]);
  const [selectedPreparations, setSelectedPreparations] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingPreparation, setEditingPreparation] = useState(null);

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
        setActivePage(data?.page || page);
        setPageSize(data?.page_size || size);
      } catch (error) {
        showError(error.message || t('加载失败'));
      } finally {
        setLoading(false);
      }
    },
    [activePage, pageSize, keyword, group, type, status, t],
  );

  const refresh = useCallback(
    () => loadPreparations(activePage, pageSize),
    [loadPreparations, activePage, pageSize],
  );

  useEffect(() => {
    loadPreparations(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const promotePreparation = useCallback(
    async (preparation) => {
      const res = await API.post(
        `/api/channel/preparations/${preparation.id}/promote`,
      );
      if (!res.data.success) {
        showError(res.data.message || t('晋升失败'));
        return false;
      }
      showSuccess(t('候选渠道已晋升为正式渠道'));
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

  const archivePreparation = useCallback(
    async (preparation) => {
      const res = await API.delete(
        `/api/channel/preparations/${preparation.id}`,
      );
      if (!res.data.success) {
        showError(res.data.message || t('归档失败'));
        return false;
      }
      showSuccess(t('候选渠道已归档'));
      refresh();
      return true;
    },
    [refresh, t],
  );

  const archiveSelected = useCallback(async () => {
    if (selectedPreparations.length === 0) {
      showInfo(t('请先选择候选渠道'));
      return;
    }
    let successCount = 0;
    for (const item of selectedPreparations) {
      const res = await API.delete(`/api/channel/preparations/${item.id}`);
      if (res.data.success) successCount += 1;
    }
    showSuccess(t('批量归档完成：{{count}} 条成功', { count: successCount }));
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
      keyword,
      setKeyword,
      group,
      setGroup,
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
      refresh,
      handleSearch,
      handlePageChange,
      handlePageSizeChange,
      openCreate,
      openEdit,
      closeEdit,
      savePreparation,
      importPreparations,
      promotePreparation,
      promoteSelected,
      archivePreparation,
      archiveSelected,
    }),
    [
      t,
      preparations,
      loading,
      activePage,
      pageSize,
      total,
      keyword,
      group,
      type,
      status,
      selectedPreparationKeys,
      selectedPreparations,
      showEdit,
      showImport,
      editingPreparation,
      refresh,
      handleSearch,
      handlePageChange,
      handlePageSizeChange,
      openCreate,
      openEdit,
      closeEdit,
      savePreparation,
      importPreparations,
      promotePreparation,
      promoteSelected,
      archivePreparation,
      archiveSelected,
    ],
  );
}
