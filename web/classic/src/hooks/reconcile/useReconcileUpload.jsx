import { useCallback, useEffect, useState } from 'react';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';

// Single hook for the reconcile upload page. Manages channel options,
// the file + channel selection, in-flight upload state, and the parsed
// result. Nothing is persisted — refresh and you start over (by design;
// the backend doesn't store anything either).
export default function useReconcileUpload() {
  const { t } = useTranslation();

  const [channels, setChannels] = useState([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [file, setFile] = useState(null);
  // granularity: 'hour' for fine-grained drift inspection, 'day' for high-volume
  // installations where 24× more rows would blow up the JSON response.
  const [granularity, setGranularity] = useState('hour');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  // loadChannels fetches every channel page-by-page. The backend caps
  // page_size at 100 (common.GetPageQuery), so deployments with > 100
  // channels need explicit pagination — a single page_size=1000 request
  // silently truncates and admins can't select the channels past page 1.
  const loadChannels = useCallback(async () => {
    const pageSize = 100;
    const collected = [];
    try {
      for (let page = 1; page < 200; page++) {
        const res = await API.get(
          `/api/channel/?p=${page}&page_size=${pageSize}`,
        );
        const { success, data } = res.data || {};
        if (!success) break;

        let items;
        let total;
        if (Array.isArray(data)) {
          items = data;
          total = undefined;
        } else {
          items = Array.isArray(data?.items) ? data.items : [];
          total = data?.total;
        }

        for (const c of items) {
          collected.push({ id: c.id, name: c.name || `#${c.id}` });
        }

        if (items.length < pageSize) break;
        if (typeof total === 'number' && collected.length >= total) break;
      }
      setChannels(collected);
    } catch {
      // leave whatever we have collected (possibly empty) in place silently
      setChannels(collected);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setSelectedChannelIds([]);
    setGranularity('hour');
  }, []);

  const submit = useCallback(async () => {
    if (!selectedChannelIds || selectedChannelIds.length === 0) {
      showError(t('请至少选择一个渠道'));
      return;
    }
    if (!file) {
      showError(t('请选择账单文件'));
      return;
    }

    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Repeat the field — backend accepts both repeated and CSV.
      selectedChannelIds.forEach((id) => fd.append('channel_ids', String(id)));
      fd.append('granularity', granularity);

      const res = await API.post('/api/reconcile/admin/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // The diff JSON for a full month can be a few MB.
        maxContentLength: 10 * 1024 * 1024,
      });
      const { success, data, message } = res.data || {};
      if (success) {
        setResult(data);
        showSuccess(t('对账完成'));
      } else {
        showError(message || t('对账失败'));
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('对账失败');
      showError(msg);
    } finally {
      setUploading(false);
    }
  }, [file, selectedChannelIds, granularity, t]);

  return {
    channels,
    selectedChannelIds,
    setSelectedChannelIds,
    file,
    setFile,
    granularity,
    setGranularity,
    uploading,
    result,
    submit,
    reset,
  };
}
