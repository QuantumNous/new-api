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
import { Modal, Select, Toast, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, selectFilter } from '../../../../helpers';

const emptyModelSelection = () => ({
  model: '',
  haiku_model: '',
  sonnet_model: '',
  opus_model: '',
});

export default function CCSwitchModal({ visible, onClose, tokenId }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState(null);
  const [target, setTarget] = useState('codex');
  const [modelsByTarget, setModelsByTarget] = useState({
    codex: emptyModelSelection(),
    claude: emptyModelSelection(),
  });
  const [modelKeyword, setModelKeyword] = useState('');

  useEffect(() => {
    if (!visible || !tokenId) return;

    let active = true;
    setLoading(true);
    API.get(`/api/token/${tokenId}/ccswitch/import-options`)
      .then((response) => {
        if (!active) return;
        const payload = response.data || {};
        if (!payload.success) {
          throw new Error(payload.message || t('加载失败'));
        }
        const nextOptions = payload.data;
        const defaultTarget =
          nextOptions.default_target === 'claude' ? 'claude' : 'codex';
        const mainModel = nextOptions.default_model || '';
        setOptions(nextOptions);
        setTarget(defaultTarget);
        setModelsByTarget({
          codex: { ...emptyModelSelection(), model: mainModel },
          claude: {
            model: mainModel,
            haiku_model: '',
            sonnet_model: '',
            opus_model: '',
          },
        });
        setModelKeyword('');
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
    () => options?.targets || [],
    [options?.targets],
  );

  const filteredModelItems = useMemo(() => {
    const words = modelKeyword
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const items = options?.models || [];
    if (words.length === 0) return items;
    return items.filter((item) => {
      const lowerName = item.name.toLowerCase();
      return words.every((word) => lowerName.includes(word));
    });
  }, [modelKeyword, options?.models]);

  const modelOptions = useMemo(() => {
    const grouped = new Map();
    for (const item of filteredModelItems) {
      const key = item.vendor_name || t('其他');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    }

    const result = [];
    for (const [key, items] of grouped.entries()) {
      result.push({
        label: key,
        value: `__vendor_${key}`,
        disabled: true,
      });
      for (const item of items) {
        result.push({ label: item.name, value: item.name });
      }
    }
    return result;
  }, [filteredModelItems, t]);

  const activeModels = modelsByTarget[target] || emptyModelSelection();

  const setModel = (field, value) => {
    setModelsByTarget((current) => ({
      ...current,
      [target]: {
        ...current[target],
        [field]: value || '',
      },
    }));
  };

  const handleSubmit = async () => {
    if (!tokenId || !target || !activeModels.model) {
      Toast.warning(t('请选择模型'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.post(
        `/api/token/${tokenId}/ccswitch/import-link`,
        {
          target,
          model: activeModels.model,
          ...(target === 'claude'
            ? {
                haiku_model: activeModels.haiku_model,
                sonnet_model: activeModels.sonnet_model,
                opus_model: activeModels.opus_model,
              }
            : {}),
        },
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

  const renderModelSelect = (field, label, optional = false) => (
    <div key={field} className='rounded-lg bg-gray-50 p-3'>
      <div className='mb-2 text-sm font-medium'>{label}</div>
      <Select
        value={activeModels[field] || undefined}
        optionList={modelOptions}
        onChange={(value) => setModel(field, value)}
        onSearch={setModelKeyword}
        onDropdownVisibleChange={(open) => {
          if (open) setModelKeyword('');
        }}
        filter={selectFilter}
        style={{ width: '100%' }}
        placeholder={optional ? t('Follow primary model') : t('请选择模型')}
        emptyContent={t('暂无数据')}
        showClear={optional}
        searchable
      />
    </div>
  );

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
          <section className='rounded-lg bg-gray-50 p-4'>
            <div className='mb-3 text-sm font-semibold'>{t('当前令牌')}</div>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              <div>
                <div className='text-xs text-gray-500'>{t('令牌名称')}</div>
                <div className='break-all font-medium'>
                  {options?.token?.name || '-'}
                </div>
              </div>
              <div>
                <div className='text-xs text-gray-500'>API Key</div>
                <div className='break-all font-medium'>
                  {options?.token?.masked_key || '-'}
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className='mb-2 text-sm font-medium'>{t('应用')}</div>
            <div className='grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1'>
              {targetOptions.map((item) => {
                const selected = item.key === target;
                return (
                  <button
                    key={item.key}
                    type='button'
                    disabled={!item.enabled}
                    className={[
                      'h-9 rounded-md px-3 text-sm font-medium transition-colors',
                      selected
                        ? 'bg-white text-gray-950 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900',
                      !item.enabled ? 'cursor-not-allowed opacity-50' : '',
                    ].join(' ')}
                    onClick={() => {
                      if (!item.enabled) return;
                      setTarget(item.key === 'claude' ? 'claude' : 'codex');
                      setModelKeyword('');
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          {renderModelSelect('model', t('主模型'))}
          {target === 'claude' && (
            <>
              {renderModelSelect('haiku_model', t('Haiku 模型'), true)}
              {renderModelSelect('sonnet_model', t('Sonnet 模型'), true)}
              {renderModelSelect('opus_model', t('Opus 模型'), true)}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
