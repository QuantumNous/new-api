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
  Banner,
  Modal,
  Select,
  Spin,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconCode,
  IconDesktop,
  IconKey,
  IconTickCircle,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, selectFilter } from '../../../../helpers';

const emptyModelSelection = () => ({
  model: '',
  haiku_model: '',
  sonnet_model: '',
  opus_model: '',
});

const targetDetails = {
  codex: {
    descriptionKey: '导入到 Codex 桌面端使用',
    importButtonKey: '导入到 Codex',
    manualTaskKeys: [
      '开启「需要本地路由映射」',
      '开启「Codex 路由启用」',
      '开启「切换第三方时保留官方登录」',
    ],
  },
  claude: {
    descriptionKey: '导入到 Claude Code 插件使用',
    importButtonKey: '导入到 Claude Code',
    manualTaskKeys: [
      '开启「应用到 Claude Code 插件」',
      '开启「跳过 Claude Code 初次安装确认」',
      '开启「Claude 路由启用」',
    ],
  },
};

export default function CCSwitchModal({ visible, onClose, tokenId }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
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
    setLoadError('');
    setOptions(null);
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
        if (active) setLoadError(error.message || t('加载失败'));
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
  const activeTargetDetails = targetDetails[target] || targetDetails.codex;

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
    <div key={field} className='min-w-0'>
      <div className='mb-1.5 text-xs font-medium text-[var(--semi-color-text-2)]'>
        {label}
      </div>
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
      okText={t(activeTargetDetails.importButtonKey)}
      cancelText={t('取消')}
      confirmLoading={submitting}
      maskClosable={false}
      closeOnEsc
      centered
      width='min(640px, calc(100vw - 32px))'
      bodyStyle={{
        maxHeight: 'calc(100vh - 190px)',
        overflowY: 'auto',
        padding: '16px 24px',
      }}
      okButtonProps={{
        disabled:
          loading || Boolean(loadError) || !options || !activeModels.model,
      }}
    >
      <div className='flex flex-col gap-4'>
        <Typography.Text type='tertiary'>
          {t('选择应用和模型，生成当前令牌的导入配置。')}
        </Typography.Text>

        {loading ? (
          <div className='flex min-h-52 items-center justify-center'>
            <Spin size='large' tip={t('加载中...')} />
          </div>
        ) : loadError ? (
          <Banner type='danger' title={t('加载失败')} description={loadError} />
        ) : !options ? (
          <Banner type='warning' title={t('暂无数据')} />
        ) : (
          <>
            <section className='flex flex-col gap-3 rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4'>
              <div className='flex shrink-0 items-center gap-2'>
                <span className='flex h-8 w-8 items-center justify-center rounded-md border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] text-[var(--semi-color-text-2)]'>
                  <IconKey />
                </span>
                <div className='text-sm font-semibold'>{t('当前令牌')}</div>
              </div>
              <div className='grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-4'>
                <div className='min-w-0'>
                  <div className='text-xs text-[var(--semi-color-text-2)]'>
                    {t('令牌名称')}
                  </div>
                  <div className='break-all text-sm font-medium'>
                    {options.token?.name || '-'}
                  </div>
                </div>
                <div className='min-w-0'>
                  <div className='text-xs text-[var(--semi-color-text-2)]'>
                    API Key
                  </div>
                  <div className='break-all text-sm font-medium'>
                    {options.token?.masked_key || '-'}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className='mb-2 text-sm font-medium'>{t('应用')}</div>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {targetOptions.map((item) => {
                  const targetKey = item.key === 'claude' ? 'claude' : 'codex';
                  const selected = item.key === target;
                  const TargetIcon =
                    targetKey === 'claude' ? IconCode : IconDesktop;
                  return (
                    <button
                      key={item.key}
                      type='button'
                      disabled={!item.enabled}
                      aria-pressed={selected}
                      className={[
                        'rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semi-color-primary-light-active)]',
                        selected
                          ? 'border-[var(--semi-color-primary)] bg-[var(--semi-color-primary-light-default)] shadow-sm'
                          : 'border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] hover:bg-[var(--semi-color-fill-0)]',
                        !item.enabled ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                      onClick={() => {
                        if (!item.enabled) return;
                        setTarget(targetKey);
                        setModelKeyword('');
                      }}
                    >
                      <div className='flex items-start gap-3'>
                        <span
                          className={[
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                            selected
                              ? 'bg-[var(--semi-color-primary-light-hover)] text-[var(--semi-color-primary)]'
                              : 'bg-[var(--semi-color-fill-0)] text-[var(--semi-color-text-2)]',
                          ].join(' ')}
                        >
                          <TargetIcon />
                        </span>
                        <div className='min-w-0 flex-1'>
                          <div className='truncate text-sm font-semibold text-[var(--semi-color-text-0)]'>
                            {item.label}
                          </div>
                          <div className='mt-1 text-xs leading-5 text-[var(--semi-color-text-2)]'>
                            {t(targetDetails[targetKey].descriptionKey)}
                          </div>
                        </div>
                        {selected ? (
                          <IconTickCircle className='mt-0.5 shrink-0 text-[var(--semi-color-primary)]' />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className='rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] p-3'>
              {renderModelSelect('model', t('主模型'))}
              {target === 'claude' ? (
                <div className='mt-3 border-t border-[var(--semi-color-border)] pt-3'>
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                    {renderModelSelect('haiku_model', t('Haiku 模型'), true)}
                    {renderModelSelect('sonnet_model', t('Sonnet 模型'), true)}
                    {renderModelSelect('opus_model', t('Opus 模型'), true)}
                  </div>
                </div>
              ) : null}
            </section>

            <Banner
              type='info'
              title={t('需要到 CC Switch 中手动开启')}
              description={
                <ol className='mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3'>
                  {activeTargetDetails.manualTaskKeys.map((taskKey, index) => (
                    <li
                      key={taskKey}
                      className='flex min-w-0 items-start gap-2 text-sm text-[var(--semi-color-text-0)]'
                    >
                      <span className='flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--semi-color-primary-light-default)] px-1 text-xs font-semibold text-[var(--semi-color-primary)]'>
                        {index + 1}
                      </span>
                      <span className='leading-5'>{t(taskKey)}</span>
                    </li>
                  ))}
                </ol>
              }
            />
          </>
        )}
      </div>
    </Modal>
  );
}
