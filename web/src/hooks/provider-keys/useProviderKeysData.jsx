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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { API, showError } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';

export const useProviderKeysData = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');

  const loadProviderKeys = async (
    page = activePage,
    size = pageSize,
    currentKeyword = keyword,
  ) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/provider_key?p=${page}&page_size=${size}&keyword=${encodeURIComponent(
          currentKeyword || '',
        )}`,
      );
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setItems(data.items || []);
      setActivePage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total || 0);
    } catch (error) {
      showError(error.message || t('加载凭证失败'));
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    await loadProviderKeys(activePage, pageSize, keyword);
  };

  const handleSearch = async () => {
    setActivePage(1);
    await loadProviderKeys(1, pageSize, keyword);
  };

  const handleReset = async () => {
    setKeyword('');
    setActivePage(1);
    await loadProviderKeys(1, pageSize, '');
  };

  const handlePageChange = async (page) => {
    setActivePage(page);
    await loadProviderKeys(page, pageSize, keyword);
  };

  const handlePageSizeChange = async (size) => {
    setPageSize(size);
    setActivePage(1);
    await loadProviderKeys(1, size, keyword);
  };

  const openLogs = (providerKeyId) => {
    navigate(`/console/log?provider_key_id=${providerKeyId}`);
  };

  useEffect(() => {
    loadProviderKeys(1, pageSize, '').catch((error) => {
      showError(error.message || t('加载凭证失败'));
    });
  }, []);

  return {
    t,
    items,
    loading,
    activePage,
    pageSize,
    total,
    keyword,
    setKeyword,
    refresh,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    openLogs,
  };
};
