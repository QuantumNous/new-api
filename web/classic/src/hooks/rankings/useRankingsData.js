import { useState, useEffect, useCallback } from 'react';
import { API } from '../../helpers/api';
import { showError } from '../../helpers/utils';

const VALID_PERIODS = ['today', 'week', 'month', 'year', 'all'];

export function useRankingsData(initialPeriod = 'week') {
  const [period, setPeriod] = useState(
    VALID_PERIODS.includes(initialPeriod) ? initialPeriod : 'week'
  );
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRankings = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get('/api/rankings', { params: { period: p } });
      const { success, message, data } = res.data;
      if (success) {
        setSnapshot(data);
      } else {
        setError(message);
        showError(message);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings(period);
  }, [period, fetchRankings]);

  const changePeriod = useCallback((p) => {
    if (VALID_PERIODS.includes(p)) setPeriod(p);
  }, []);

  return { period, changePeriod, snapshot, loading, error };
}
