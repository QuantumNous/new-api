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
import { API, copy, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';

export const useOAuthClientsData = () => {
  const { t } = useTranslation();

  // Basic state
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [clientCount, setClientCount] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [searching, setSearching] = useState(false);

  // Selection state
  const [selectedKeys, setSelectedKeys] = useState([]);

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editingClient, setEditingClient] = useState({
    client_id: undefined,
  });

  // Form state
  const [formApi, setFormApi] = useState(null);
  const formInitValues = {
    searchKeyword: '',
  };

  // Get form values helper function
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
    };
  };

  // Close edit modal
  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingClient({
        client_id: undefined,
      });
    }, 500);
  };

  // Sync page data from API response
  const syncPageData = (payload) => {
    if (Array.isArray(payload)) {
      setClients(payload);
      setClientCount(payload.length);
    } else {
      setClients(payload.items || []);
      setClientCount(payload.total || 0);
      setActivePage(payload.page || 1);
      setPageSize(payload.page_size || pageSize);
    }
  };

  // Load clients function
  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/oauth/admin/clients');
      const { success, message, data } = res.data;
      if (success) {
        syncPageData(data || []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message || t('加载失败'));
    }
    setLoading(false);
  };

  // Refresh function
  const refresh = async () => {
    await loadClients();
    setSelectedKeys([]);
  };

  // Copy text function
  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制到剪贴板！'));
    } else {
      Modal.error({
        title: t('无法复制到剪贴板，请手动复制'),
        content: text,
        size: 'large',
      });
    }
  };

  // Create client function
  const createClient = async (clientData) => {
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/admin/clients', clientData);
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('客户端创建成功！'));
        await refresh();
        return data;
      } else {
        showError(message);
        return null;
      }
    } catch (error) {
      showError(error.message || t('创建失败'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Delete client function
  const deleteClient = async (clientId) => {
    setLoading(true);
    try {
      const res = await API.delete(`/api/oauth/admin/clients/${clientId}`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('删除成功'));
        await refresh();
        return true;
      } else {
        showError(message);
        return false;
      }
    } catch (error) {
      showError(error.message || t('删除失败'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Search clients function
  const searchClients = async () => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadClients();
      return;
    }
    setSearching(true);
    // Filter clients locally for now
    const filteredClients = clients.filter(
      (client) =>
        client.client_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        client.client_id?.toLowerCase().includes(searchKeyword.toLowerCase())
    );
    setClients(filteredClients);
    setClientCount(filteredClients.length);
    setSearching(false);
  };

  // Page handlers
  const handlePageChange = (page) => {
    setActivePage(page);
  };

  const handlePageSizeChange = async (size) => {
    setPageSize(size);
    setActivePage(1);
  };

  // Row selection handlers
  const rowSelection = {
    onSelect: (record, selected) => {},
    onSelectAll: (selected, selectedRows) => {},
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedKeys(selectedRows);
    },
  };

  // Batch delete clients
  const batchDeleteClients = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请先选择要删除的客户端！'));
      return;
    }
    setLoading(true);
    try {
      let successCount = 0;
      for (const client of selectedKeys) {
        const res = await API.delete(`/api/oauth/admin/clients/${client.client_id}`);
        if (res.data?.success) {
          successCount++;
        }
      }
      showSuccess(t('已删除 {{count}} 个客户端！', { count: successCount }));
      await refresh();
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize data
  useEffect(() => {
    loadClients().catch((reason) => {
      showError(reason);
    });
  }, []);

  return {
    // Basic state
    clients,
    loading,
    activePage,
    clientCount,
    pageSize,
    searching,

    // Selection state
    selectedKeys,
    setSelectedKeys,

    // Edit state
    showEdit,
    setShowEdit,
    editingClient,
    setEditingClient,
    closeEdit,

    // Form state
    formApi,
    setFormApi,
    formInitValues,
    getFormValues,

    // Functions
    loadClients,
    refresh,
    copyText,
    createClient,
    deleteClient,
    searchClients,
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    batchDeleteClients,
    syncPageData,

    // Translation
    t,
  };
};
