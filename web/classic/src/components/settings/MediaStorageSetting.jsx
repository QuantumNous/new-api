import React, { useEffect, useState } from 'react';
import { Card, Spin } from '@douyinfe/semi-ui';
import SettingsObs from '../../pages/Setting/Storage/SettingsObs';
import MediaStorageStats from '../../pages/Setting/Storage/MediaStorageStats';
import { API, showError, toBoolean } from '../../helpers';

const MediaStorageSetting = () => {
  let [inputs, setInputs] = useState({
    'media_storage.enabled': false,
    'media_storage.provider': 'obs',
    'media_storage.credential_type': 'static',
    'media_storage.endpoint': '',
    'media_storage.region': '',
    'media_storage.bucket': '',
    'media_storage.signed_url_ttl_hours': '168',
    'media_storage.max_object_size_mb': '200',
    'media_storage.nfs_output_root': '/nfs-output',
    'media_storage.ingest_nfs_path': true,
    'media_storage.ingest_upstream_url': true,
    'media_storage.async_worker_count': '4',
    'media_storage.stats_snapshot_interval_minutes': '60',
    'media_storage.bucket_warn_threshold_tb': '2',
    'media_storage.bucket_critical_threshold_tb': '3',
    'media_storage.alert_webhook': '',
    'media_storage.alert_dedup_hours': '24',
  });
  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (!item.key.startsWith('media_storage.')) return;
        if (typeof inputs[item.key] === 'boolean') {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
        }
      });
      setInputs((prev) => ({ ...prev, ...newInputs }));
    } else {
      showError(message);
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
  }, []);

  return (
    <Spin spinning={loading} size='large'>
      <Card style={{ marginTop: '10px' }}>
        <SettingsObs options={inputs} refresh={onRefresh} />
      </Card>
      <MediaStorageStats />
    </Spin>
  );
};

export default MediaStorageSetting;
