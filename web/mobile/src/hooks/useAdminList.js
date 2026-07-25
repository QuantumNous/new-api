import { useCallback, useEffect, useState } from 'react';

import { API } from '@classic/helpers/api';

import { showError } from '../shims/classic-utils';

// 管理端审批列表通用逻辑：状态筛选 + 加载。
// 列表接口约定：GET {baseUrl}?status=&page=&page_size= → {success, data: [], total}
const useAdminList = (baseUrl, defaultStatus = 1) => {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(defaultStatus);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (s = status) => {
      setLoading(true);
      try {
        const res = await API.get(
          `${baseUrl}?status=${s}&page=1&page_size=50`,
        );
        if (res.data.success) {
          setList(res.data.data || []);
          setTotal(res.data.total || 0);
        } else {
          showError(res.data.message);
        }
      } catch (e) {
        showError(e);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, status],
  );

  useEffect(() => {
    load(status);
  }, [status, load]);

  return { list, total, status, setStatus, loading, reload: () => load(status) };
};

export default useAdminList;
