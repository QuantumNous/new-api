import { useState, useCallback, useEffect } from 'react';
import { API, showError, timestamp2string } from '../../helpers';

const getInitialTimestamp = () => {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return timestamp2string(start.getTime() / 1000);
};

const ENDPOINT_MAP = {
  byUser: '/api/data/by-user',
  byModel: '/api/data/by-model',
  byDetail: '/api/data/by-detail',
};

const EXPORT_TYPE_MAP = {
  byUser: 'by_user',
  byModel: 'by_model',
  byDetail: 'by_detail',
};

export const useUserModelStats = () => {
  const [activeTab, setActiveTab] = useState('byUser');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [inputs, setInputs] = useState({
    start_timestamp: getInitialTimestamp(),
    end_timestamp: timestamp2string(new Date().getTime() / 1000 + 3600),
    username: '',
    model_name: '',
    user_group: '',
  });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  const localStartTimestamp = Math.floor(Date.parse(inputs.start_timestamp) / 1000);
  const localEndTimestamp = Math.floor(Date.parse(inputs.end_timestamp) / 1000);

  const buildQuery = useCallback((base) => {
    const params = new URLSearchParams();
    params.append('start_timestamp', localStartTimestamp);
    params.append('end_timestamp', localEndTimestamp);
    if (inputs.username) params.append('username', inputs.username);
    if (inputs.model_name) params.append('model_name', inputs.model_name);
    if (inputs.user_group) params.append('user_group', inputs.user_group);
    return `${base}?${params.toString()}`;
  }, [localStartTimestamp, localEndTimestamp, inputs]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = ENDPOINT_MAP[activeTab] || ENDPOINT_MAP.byUser;
      const url = `${buildQuery(endpoint)}&page=${pagination.page}&page_size=${pagination.pageSize}`;
      const res = await API.get(url);
      if (res.data.success) {
        setData(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (err) {
      showError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildQuery, pagination]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = useCallback((name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSearch = useCallback(() => {
    setPagination({ page: 1, pageSize: 20 });
  }, []);

  const handleExport = useCallback(async () => {
    const viewType = EXPORT_TYPE_MAP[activeTab] || 'by_user';
    const url = `${buildQuery('/api/data/export')}&view_type=${viewType}`;
    try {
      const res = await API.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `user-model-stats-${viewType}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      showError(err?.message || '导出失败');
    }
  }, [activeTab, buildQuery]);

  return {
    activeTab,
    setActiveTab,
    loading,
    listData: data,
    inputs,
    pagination,
    setPagination,
    handleInputChange,
    handleSearch,
    handleExport,
  };
};
