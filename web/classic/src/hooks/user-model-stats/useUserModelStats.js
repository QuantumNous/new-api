import { useState, useCallback, useEffect } from 'react';
import { API, showError, timestamp2string } from '../../helpers';

const getInitialTimestamp = () => {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return timestamp2string(start.getTime() / 1000);
};

export const useUserModelStats = () => {
  const [activeTab, setActiveTab] = useState('byUser');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [matrixData, setMatrixData] = useState(null);
  const [inputs, setInputs] = useState({
    start_timestamp: getInitialTimestamp(),
    end_timestamp: timestamp2string(new Date().getTime() / 1000 + 3600),
    username: '',
    model_name: '',
  });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [matrixPagination, setMatrixPagination] = useState({ userPage: 1, modelPage: 1, pageSize: 20 });
  const [matrixPivot, setMatrixPivot] = useState('user_as_row');

  const localStartTimestamp = Math.floor(Date.parse(inputs.start_timestamp) / 1000);
  const localEndTimestamp = Math.floor(Date.parse(inputs.end_timestamp) / 1000);

  const buildQuery = useCallback((base) => {
    const params = new URLSearchParams();
    params.append('start_timestamp', localStartTimestamp);
    params.append('end_timestamp', localEndTimestamp);
    if (inputs.username) params.append('username', inputs.username);
    if (inputs.model_name) params.append('model_name', inputs.model_name);
    return `${base}?${params.toString()}`;
  }, [localStartTimestamp, localEndTimestamp, inputs]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'byUser' || activeTab === 'byModel') {
        const endpoint = activeTab === 'byUser' ? '/api/data/by-user' : '/api/data/by-model';
        const url = `${buildQuery(endpoint)}&page=${pagination.page}&page_size=${pagination.pageSize}`;
        const res = await API.get(url);
        if (res.data.success) {
          setData(res.data.data);
        } else {
          showError(res.data.message);
        }
      } else {
        const url = `${buildQuery('/api/data/matrix')}&user_page=${matrixPagination.userPage}&model_page=${matrixPagination.modelPage}&page_size=${matrixPagination.pageSize}`;
        const res = await API.get(url);
        if (res.data.success) {
          setMatrixData(res.data.data);
        } else {
          showError(res.data.message);
        }
      }
    } catch (err) {
      showError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildQuery, pagination, matrixPagination]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = useCallback((name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSearch = useCallback(() => {
    setPagination({ page: 1, pageSize: 20 });
    setMatrixPagination({ userPage: 1, modelPage: 1, pageSize: 20 });
    fetchData();
  }, [fetchData]);

  const handleExport = useCallback(() => {
    const viewType = activeTab === 'byUser' ? 'by_user' : activeTab === 'byModel' ? 'by_model' : 'matrix';
    const url = `${buildQuery('/api/data/export')}&view_type=${viewType}`;
    window.open(url, '_blank');
  }, [activeTab, buildQuery]);

  return {
    activeTab,
    setActiveTab,
    loading,
    listData: data,
    matrixData,
    inputs,
    pagination,
    setPagination,
    matrixPagination,
    setMatrixPagination,
    matrixPivot,
    setMatrixPivot,
    handleInputChange,
    handleSearch,
    handleExport,
  };
};
