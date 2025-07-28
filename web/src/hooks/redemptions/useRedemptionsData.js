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
import { API, showError, showSuccess, copy } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { REDEMPTION_ACTIONS, REDEMPTION_STATUS } from '../../constants/redemption.constants';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useRedemptionsData = () => {
  const { t } = useTranslation();

  // Basic state
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [tokenCount, setTokenCount] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState([]);

  // Edit state
  const [editingRedemption, setEditingRedemption] = useState({
    id: undefined,
  });
  const [showEdit, setShowEdit] = useState(false);

  // Form API
  const [formApi, setFormApi] = useState(null);

  // UI state
  const [compactMode, setCompactMode] = useTableCompactMode('redemptions');

  // Form state
  const formInitValues = {
    searchKeyword: '',
  };

  // Get form values
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
    };
  };

  // Set redemption data format
  const setRedemptionFormat = (redemptions) => {
    setRedemptions(redemptions);
  };

  // Load redemption list
  const loadRedemptions = async (page = 1, pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/redemption/?p=${page}&page_size=${pageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const newPageData = data.items;
        setActivePage(data.page <= 0 ? 1 : data.page);
        setTokenCount(data.total);
        setRedemptionFormat(newPageData);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  // Search redemption codes
  const searchRedemptions = async () => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadRedemptions(1, pageSize);
      return;
    }

    setSearching(true);
    try {
      const res = await API.get(
        `/api/redemption/search?keyword=${searchKeyword}&p=1&page_size=${pageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const newPageData = data.items;
        setActivePage(data.page || 1);
        setTokenCount(data.total);
        setRedemptionFormat(newPageData);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setSearching(false);
  };

  // Manage redemption codes (CRUD operations)
  const manageRedemption = async (id, action, record) => {
    setLoading(true);
    let data = { id };
    let res;

    try {
      switch (action) {
        case REDEMPTION_ACTIONS.DELETE:
          res = await API.delete(`/api/redemption/${id}/`);
          break;
        case REDEMPTION_ACTIONS.ENABLE:
          data.status = REDEMPTION_STATUS.UNUSED;
          res = await API.put('/api/redemption/?status_only=true', data);
          break;
        case REDEMPTION_ACTIONS.DISABLE:
          data.status = REDEMPTION_STATUS.DISABLED;
          res = await API.put('/api/redemption/?status_only=true', data);
          break;
        default:
          throw new Error('Unknown operation type');
      }

      const { success, message } = res.data;
      if (success) {
        showSuccess('操作成功完成！');
        let redemption = res.data.data;
        let newRedemptions = [...redemptions];
        if (action !== REDEMPTION_ACTIONS.DELETE) {
          record.status = redemption.status;
        }
        setRedemptions(newRedemptions);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  // Refresh data
  const refresh = async (page = activePage) => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadRedemptions(page, pageSize);
    } else {
      await searchRedemptions();
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setActivePage(page);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadRedemptions(page, pageSize);
    } else {
      searchRedemptions();
    }
  };

  // Handle page size change
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadRedemptions(1, size);
    } else {
      searchRedemptions();
    }
  };

  // Row selection configuration
  const rowSelection = {
    onSelect: (record, selected) => { },
    onSelectAll: (selected, selectedRows) => { },
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedKeys(selectedRows);
    },
  };

  // Row style handling - using isExpired function
  const handleRow = (record, index) => {
    // Local isExpired function
    const isExpired = (rec) => {
      return rec.status === REDEMPTION_STATUS.UNUSED &&
        rec.expired_time !== 0 &&
        rec.expired_time < Math.floor(Date.now() / 1000);
    };

    if (record.status !== REDEMPTION_STATUS.UNUSED || isExpired(record)) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    } else {
      return {};
    }
  };

  // Copy text
  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess('已复制到剪贴板！');
    } else {
      Modal.error({
        title: '无法复制到剪贴板，请手动复制',
        content: text,
        size: 'large'
      });
    }
  };

  // Batch copy redemption codes
  const batchCopyRedemptions = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个兑换码！'));
      return;
    }

    let keys = '';
    for (let i = 0; i < selectedKeys.length; i++) {
      keys += selectedKeys[i].name + '    ' + selectedKeys[i].key + '\n';
    }
    await copyText(keys);
  };

  // Batch delete redemption codes (clear invalid)
  const batchDeleteRedemptions = async () => {
    Modal.confirm({
      title: t('确定清除所有失效兑换码？'),
      content: t('将删除已使用、已禁用及过期的兑换码，此操作不可撤销。'),
      onOk: async () => {
        setLoading(true);
        const res = await API.delete('/api/redemption/invalid');
        const { success, message, data } = res.data;
        if (success) {
          showSuccess(t('已删除 {{count}} 条失效兑换码', { count: data }));
          await refresh();
        } else {
          showError(message);
        }
        setLoading(false);
      },
    });
  };

  // Close edit modal
  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingRedemption({
        id: undefined,
      });
    }, 500);
  };

  // Remove record (for UI update after deletion)
  const removeRecord = (key) => {
    let newDataSource = [...redemptions];
    if (key != null) {
      let idx = newDataSource.findIndex((data) => data.key === key);
      if (idx > -1) {
        newDataSource.splice(idx, 1);
        setRedemptions(newDataSource);
      }
    }
  };

  // Initialize data loading
  useEffect(() => {
    loadRedemptions(1, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, [pageSize]);

  return {
    // Data state
    redemptions,
    loading,
    searching,
    activePage,
    pageSize,
    tokenCount,
    selectedKeys,

    // Edit state
    editingRedemption,
    showEdit,

    // Form state
    formApi,
    formInitValues,

    // UI state
    compactMode,
    setCompactMode,

    // Data operations
    loadRedemptions,
    searchRedemptions,
    manageRedemption,
    refresh,
    copyText,
    removeRecord,

    // State updates
    setActivePage,
    setPageSize,
    setSelectedKeys,
    setEditingRedemption,
    setShowEdit,
    setFormApi,
    setLoading,

    // Event handlers
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    handleRow,
    closeEdit,
    getFormValues,

    // Batch operations
    batchCopyRedemptions,
    batchDeleteRedemptions,

    // Translation function
    t,
  };
}; 