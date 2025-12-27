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

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useDeploymentsData = () => {
  const { t } = useTranslation();
  const [compactMode, setCompactMode] = useTableCompactMode('deployments');

  // State management
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [searching, setSearching] = useState(false);
  const [deploymentCount, setDeploymentCount] = useState(0);

  // Modal states
  const [showEdit, setShowEdit] = useState(false);
  const [editingDeployment, setEditingDeployment] = useState({
    id: undefined,
  });

  // Row selection
  const [selectedKeys, setSelectedKeys] = useState([]);
  const rowSelection = {
    getCheckboxProps: (record) => ({
      name: record.deployment_name,
    }),
    selectedRowKeys: selectedKeys.map((deployment) => deployment.id),
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedKeys(selectedRows);
    },
  };

  // Form initial values
  const formInitValues = {
    searchKeyword: '',
    searchStatus: '',
  };

  // ---------- helpers ----------
  // Safely extract array items from API payload
  const extractItems = (payload) => {
    const items = payload?.items || payload || [];
    return Array.isArray(items) ? items : [];
  };

  // Form API reference
  const [formApi, setFormApi] = useState(null);

  // Get form values helper function
  const getFormValues = () => formApi?.getValues() || formInitValues;

  // Close edit modal
  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingDeployment({ id: undefined });
    }, 500);
  };

  // Set deployment format with key field
  const setDeploymentFormat = (deployments) => {
    for (let i = 0; i < deployments.length; i++) {
      deployments[i].key = deployments[i].id;
    }
    setDeployments(deployments);
  };

  // Status tabs
  const [activeStatusKey, setActiveStatusKey] = useState('all');
  const [statusCounts, setStatusCounts] = useState({});

  // Column visibility
  const COLUMN_KEYS = useMemo(
    () => ({
      id: 'id',
      status: 'status',
      provider: 'provider',
      container_name: 'container_name',
      time_remaining: 'time_remaining',
      hardware_info: 'hardware_info',
      created_at: 'created_at',
      actions: 'actions',
      // Legacy keys for compatibility
      deployment_name: 'deployment_name',
      model_name: 'model_name',
      instance_count: 'instance_count',
      resource_config: 'resource_config',
      updated_at: 'updated_at',
    }),
    [],
  );

  const ensureRequiredColumns = (columns = {}) => {
    const normalized = {
      ...columns,
      [COLUMN_KEYS.container_name]: true,
      [COLUMN_KEYS.actions]: true,
    };

    if (normalized[COLUMN_KEYS.provider] === undefined) {
      normalized[COLUMN_KEYS.provider] = true;
    }

    return normalized;
  };

  const [visibleColumns, setVisibleColumnsState] = useState(() => {
    const saved = localStorage.getItem('deployments_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return ensureRequiredColumns(parsed);
      } catch (e) {
        console.error('Failed to parse saved column visibility:', e);
      }
    }
    return ensureRequiredColumns({
      [COLUMN_KEYS.container_name]: true,
      [COLUMN_KEYS.status]: true,
      [COLUMN_KEYS.provider]: true,
      [COLUMN_KEYS.time_remaining]: true,
      [COLUMN_KEYS.hardware_info]: true,
      [COLUMN_KEYS.created_at]: true,
      [COLUMN_KEYS.actions]: true,
      // Legacy columns (hidden by default)
      [COLUMN_KEYS.deployment_name]: false,
      [COLUMN_KEYS.model_name]: false,
      [COLUMN_KEYS.instance_count]: false,
      [COLUMN_KEYS.resource_config]: false,
      [COLUMN_KEYS.updated_at]: false,
    });
  });

  // Column selector modal
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Save column visibility to localStorage
  const saveColumnVisibility = (newVisibleColumns) => {
    const normalized = ensureRequiredColumns(newVisibleColumns);
    localStorage.setItem('deployments_visible_columns', JSON.stringify(normalized));
    setVisibleColumnsState(normalized);
  };

  // Load deployments data
  const loadDeployments = async (
    page = 1,
    size = pageSize,
    statusKey = activeStatusKey,
  ) => {
    setLoading(true);
    try {
      let url = `/api/deployments/?p=${page}&page_size=${size}`;
      if (statusKey && statusKey !== 'all') {
        url = `/api/deployments/search?status=${statusKey}&p=${page}&page_size=${size}`;
      }

      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        const newPageData = extractItems(data);
        setActivePage(data.page || page);
        setDeploymentCount(data.total || newPageData.length);
        setDeploymentFormat(newPageData);

        if (data.status_counts) {
          const sumAll = Object.values(data.status_counts).reduce(
            (acc, v) => acc + v,
            0,
          );
          setStatusCounts({ ...data.status_counts, all: sumAll });
        }
      } else {
        showError(message);
        setDeployments([]);
      }
    } catch (error) {
      console.error(error);
      showError(t('获取部署列表失败'));
      setDeployments([]);
    }
    setLoading(false);
  };

  // Search deployments
  const searchDeployments = async (searchTerms) => {
    setSearching(true);
    try {
      const { searchKeyword, searchStatus } = searchTerms;
      const params = new URLSearchParams({
        p: '1',
        page_size: pageSize.toString(),
      });

      if (searchKeyword?.trim()) {
        params.append('keyword', searchKeyword.trim());
      }
      if (searchStatus && searchStatus !== 'all') {
        params.append('status', searchStatus);
      }

      const res = await API.get(`/api/deployments/search?${params}`);
      const { success, message, data } = res.data;
      
      if (success) {
        const items = extractItems(data);
        setActivePage(1);
        setDeploymentCount(data.total || items.length);
        setDeploymentFormat(items);
      } else {
        showError(message);
        setDeployments([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      showError(t('搜索失败'));
      setDeployments([]);
    }
    setSearching(false);
  };

  // Refresh data
  const refresh = async (page = activePage) => {
    await loadDeployments(page, pageSize);
  };

  // Handle page change
  const handlePageChange = (page) => {
    setActivePage(page);
    if (!searching) {
      loadDeployments(page, pageSize);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    if (!searching) {
      loadDeployments(1, size);
    }
  };

  // Handle tab change
  const handleTabChange = (statusKey) => {
    setActiveStatusKey(statusKey);
    setActivePage(1);
    loadDeployments(1, pageSize, statusKey);
  };

  // Deployment operations
  const startDeployment = async (deploymentId) => {
    try {
      const res = await API.post(`/api/deployments/${deploymentId}/start`);
      if (res.data.success) {
        showSuccess(t('部署启动成功'));
        await refresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      console.error(error);
      showError(t('启动部署失败'));
    }
  };

  const restartDeployment = async (deploymentId) => {
    try {
      const res = await API.post(`/api/deployments/${deploymentId}/restart`);
      if (res.data.success) {
        showSuccess(t('部署重启成功'));
        await refresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      console.error(error);
      showError(t('重启部署失败'));
    }
  };

  const deleteDeployment = async (deploymentId) => {
    try {
      const res = await API.delete(`/api/deployments/${deploymentId}`);
      if (res.data.success) {
        showSuccess(t('部署删除成功'));
        await refresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      console.error(error);
      showError(t('删除部署失败'));
    }
  };

  const syncDeploymentToChannel = async (deployment) => {
    if (!deployment?.id) {
      showError(t('同步渠道失败：缺少部署信息'));
      return;
    }

    try {
      const containersResp = await API.get(`/api/deployments/${deployment.id}/containers`);
      if (!containersResp.data?.success) {
        showError(containersResp.data?.message || t('获取容器信息失败'));
        return;
      }

      const containers = containersResp.data?.data?.containers || [];
      const activeContainer = containers.find((ctr) => ctr?.public_url);

      if (!activeContainer?.public_url) {
        showError(t('未找到可用的容器访问地址'));
        return;
      }

      const rawUrl = String(activeContainer.public_url).trim();
      const baseUrl = rawUrl.replace(/\/+$/, '');
      if (!baseUrl) {
        showError(t('容器访问地址无效'));
        return;
      }

      const baseName = deployment.container_name || deployment.deployment_name || deployment.name || deployment.id;
      const safeName = String(baseName || 'ionet').slice(0, 60);
      const channelName = `[IO.NET] ${safeName}`;

      let randomKey;
      try {
        randomKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? `ionet-${crypto.randomUUID().replace(/-/g, '')}`
          : null;
      } catch (err) {
        randomKey = null;
      }
      if (!randomKey) {
        randomKey = `ionet-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      }

      const otherInfo = {
        source: 'ionet',
        deployment_id: deployment.id,
        deployment_name: safeName,
        container_id: activeContainer.container_id || null,
        public_url: baseUrl,
      };

      const payload = {
        mode: 'single',
        channel: {
          name: channelName,
          type: 4,
          key: randomKey,
          base_url: baseUrl,
          group: 'default',
          tag: 'ionet',
          remark: `[IO.NET] Auto-synced from deployment ${deployment.id}`,
          other_info: JSON.stringify(otherInfo),
        },
      };

      const createResp = await API.post('/api/channel/', payload);
      if (createResp.data?.success) {
        showSuccess(t('已同步到渠道'));
      } else {
        showError(createResp.data?.message || t('同步渠道失败'));
      }
    } catch (error) {
      console.error(error);
      showError(t('同步渠道失败'));
    }
  };

  const updateDeploymentName = async (deploymentId, newName) => {
    try {
      const res = await API.put(`/api/deployments/${deploymentId}/name`, { name: newName });
      if (res.data.success) {
        showSuccess(t('部署名称更新成功'));
        await refresh();
        return true;
      } else {
        showError(res.data.message);
        return false;
      }
    } catch (error) {
      console.error(error);
      showError(t('更新部署名称失败'));
      return false;
    }
  };

  // Batch operations
  const batchDeleteDeployments = async () => {
    if (selectedKeys.length === 0) return;
    
    try {
      const ids = selectedKeys.map(deployment => deployment.id);
      const res = await API.post('/api/deployments/batch_delete', { ids });
      if (res.data.success) {
        showSuccess(t('批量删除成功'));
        setSelectedKeys([]);
        await refresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      console.error(error);
      showError(t('批量删除失败'));
    }
  };

  // Table row click handler
  const handleRow = (record) => ({
    onClick: () => {
      // Handle row click if needed
    },
  });

  // Initial load
  useEffect(() => {
    loadDeployments();
  }, []);

  return {
    // Data
    deployments,
    loading,
    searching,
    activePage,
    pageSize,
    deploymentCount,
    statusCounts,
    activeStatusKey,
    compactMode,
    setCompactMode,

    // Selection
    selectedKeys,
    setSelectedKeys,
    rowSelection,

    // Modals
    showEdit,
    setShowEdit,
    editingDeployment,
    setEditingDeployment,
    closeEdit,

    // Column visibility
    visibleColumns,
    setVisibleColumns: saveColumnVisibility,
    showColumnSelector,
    setShowColumnSelector,
    COLUMN_KEYS,

    // Form
    formInitValues,
    formApi,
    setFormApi,
    getFormValues,

    // Operations
    loadDeployments,
    searchDeployments,
    refresh,
    handlePageChange,
    handlePageSizeChange,
    handleTabChange,
    handleRow,

    // Deployment operations
    startDeployment,
    restartDeployment,
    deleteDeployment,
    updateDeploymentName,
    syncDeploymentToChannel,

    // Batch operations
    batchDeleteDeployments,

    // Translation
    t,
  };
};
