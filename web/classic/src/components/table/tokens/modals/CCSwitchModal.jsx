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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Descriptions,
  Modal,
  Select,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, selectFilter } from '../../../../helpers';

export default function CCSwitchModal({ visible, onClose, tokenId }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState(null);
  const [models, setModels] = useState([]);
  const [target, setTarget] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    if (!visible || !tokenId) return;

    let active = true;
    setLoading(true);
    Promise.all([
      API.get(`/api/token/${tokenId}/ccswitch/import-options`),
      API.get('/api/user/models'),
    ])
      .then(([optionsResponse, modelsResponse]) => {
        if (!active) return;
        const optionsPayload = optionsResponse.data || {};
        if (!optionsPayload.success) {
          throw new Error(optionsPayload.message || t('加载失败'));
        }
        const nextOptions = optionsPayload.data;
        setOptions(nextOptions);
        setTarget(nextOptions.default_target || '');
        setModel(nextOptions.default_model || '');
        setModels(modelsResponse.data?.data || []);
      })
      .catch((error) => {
        if (active) Toast.error(error.message || t('加载失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible, tokenId, t]);

  const targetOptions = useMemo(
    () =>
      (options?.targets || []).map((item) => ({
        label: item.enabled
          ? item.label
          : `${item.label} (${item.disabled_reason || '-'})`,
        value: item.key,
        disabled: !item.enabled,
      })),
    [options?.targets, t],
  );

  const modelOptions = useMemo(() => {
    const values = [options?.default_model, ...models].filter(Boolean);
    return [...new Set(values)].map((item) => ({ label: item, value: item }));
  }, [models, options?.default_model]);

  const handleSubmit = async () => {
    if (!tokenId || !target || !model) {
      Toast.warning(t('请选择模型'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.post(
        `/api/token/${tokenId}/ccswitch/import-link`,
        { target, model },
      );
      const payload = response.data || {};
      if (!payload.success || !payload.data?.url) {
        throw new Error(payload.message || t('操作失败'));
      }
      window.location.href = payload.data.url;
      onClose();
    } catch (error) {
      Toast.error(error.message || t('操作失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`${t('导入')} CC Switch`}
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={t('导入')}
      cancelText={t('取消')}
      confirmLoading={submitting}
      maskClosable={false}
      width={520}
    >
      {loading ? (
        <Typography.Text type='tertiary'>{t('加载中...')}</Typography.Text>
      ) : (
        <div className='flex flex-col gap-4'>
          <Descriptions
            data={[
              { key: t('名称'), value: options?.token?.name || '-' },
              { key: 'API Key', value: options?.token?.masked_key || '-' },
              { key: 'BaseURL', value: options?.token?.base_url || '-' },
            ]}
            row
            size='small'
          />

          <div>
            <div className='mb-1 text-sm'>{t('应用')}</div>
            <Select
              value={target || undefined}
              optionList={targetOptions}
              onChange={setTarget}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <div className='mb-1 text-sm'>{t('模型')}</div>
            <Select
              value={model || undefined}
              optionList={modelOptions}
              onChange={setModel}
              filter={selectFilter}
              style={{ width: '100%' }}
              searchable
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
