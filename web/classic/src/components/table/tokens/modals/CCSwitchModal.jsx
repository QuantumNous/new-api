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
import { Banner, Modal, Select, Spin, Toast } from '@douyinfe/semi-ui';
import {
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
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
    label: 'Codex',
    abbreviation: 'C',
    descriptionKey: '导入到 Codex 桌面端使用',
    importButtonKey: '导入到 Codex',
    manualTaskKeys: [
      '开启「需要本地路由映射」',
      '开启「Codex 路由启用」',
      '开启「切换第三方时保留官方登录」',
    ],
  },
  claude: {
    label: 'Claude Code',
    abbreviation: 'CC',
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
        setAdvancedOpen(false);
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

  const renderTokenField = (label, value, className = '') => (
    <div
      className={[
        'min-w-0 rounded-lg bg-[var(--semi-color-bg-0)] px-3 py-2 shadow-[inset_0_0_0_1px_var(--semi-color-border)]',
        className,
      ].join(' ')}
    >
      <div className='text-xs text-[var(--semi-color-text-2)]'>{label}</div>
      <div className='break-all text-sm font-medium text-[var(--semi-color-text-0)]'>
        {value || '-'}
      </div>
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
      width='min(560px, calc(100vw - 32px))'
      bodyStyle={{
        maxHeight: 'calc(100vh - 190px)',
        overflowY: 'auto',
        padding: '14px 20px',
      }}
      okButtonProps={{
        disabled:
          loading || Boolean(loadError) || !options || !activeModels.model,
      }}
    >
      <div className='flex flex-col gap-3'>
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
            <section className='flex flex-col gap-2'>
              <div className='text-sm font-semibold'>{t('当前令牌')}</div>
              <div className='overflow-hidden rounded-2xl border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] p-3 shadow-sm'>
                <div className='grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2'>
                  {renderTokenField(t('令牌名称'), options.token?.name)}
                  {renderTokenField('API Key', options.token?.masked_key)}
                  {renderTokenField(
                    t('API地址'),
                    options.token?.base_url,
                    'sm:col-span-2',
                  )}
                </div>
              </div>
            </section>

            <section className='flex flex-col gap-2'>
              <div className='text-sm font-semibold'>{t('应用')}</div>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {targetOptions.map((item) => {
                  const targetKey = item.key === 'claude' ? 'claude' : 'codex';
                  const selected = item.key === target;
                  const targetDetail = targetDetails[targetKey];
                  return (
                    <button
                      key={item.key}
                      type='button'
                      disabled={!item.enabled}
                      aria-pressed={selected}
                      className={[
                        'min-h-20 rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semi-color-primary-light-active)]',
                        selected
                          ? 'border-[var(--semi-color-primary)] bg-[var(--semi-color-primary-light-default)] shadow-sm'
                          : 'border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] hover:-translate-y-0.5 hover:bg-[var(--semi-color-fill-0)] hover:shadow-sm',
                        !item.enabled ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                      onClick={() => {
                        if (!item.enabled) return;
                        setTarget(targetKey);
                        setAdvancedOpen(false);
                        setModelKeyword('');
                      }}
                    >
                      <div className='flex items-start gap-3'>
                        <span
                          className={[
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
                            selected
                              ? 'bg-[var(--semi-color-primary-light-hover)] text-[var(--semi-color-primary)]'
                              : 'bg-[var(--semi-color-fill-0)] text-[var(--semi-color-text-2)]',
                          ].join(' ')}
                        >
                          <span className='text-sm font-bold leading-none tracking-tight'>
                            {targetDetail.abbreviation}
                          </span>
                        </span>
                        <div className='min-w-0 flex-1'>
                          <div className='truncate text-sm font-semibold text-[var(--semi-color-text-0)]'>
                            {targetDetail.label}
                          </div>
                          <div className='mt-1 text-xs leading-5 text-[var(--semi-color-text-2)]'>
                            {t(targetDetail.descriptionKey)}
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

            <section className='flex flex-col gap-2'>
              <div className='text-sm font-semibold'>{t('主模型')}</div>
              <div className='overflow-hidden rounded-2xl border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] p-3 shadow-sm'>
                {renderModelSelect('model', t('主模型'))}
              </div>
              {target === 'claude' ? (
                <div className='overflow-hidden rounded-2xl border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] shadow-sm'>
                  <button
                    type='button'
                    className='flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--semi-color-fill-0)]'
                    onClick={() => setAdvancedOpen((open) => !open)}
                  >
                    <span className='min-w-0'>
                      <span className='block text-sm font-semibold text-[var(--semi-color-text-0)]'>
                        {t('高级设置')}
                      </span>
                      <span className='block text-xs text-[var(--semi-color-text-2)]'>
                        {t('Follow primary model')}
                      </span>
                    </span>
                    {advancedOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </button>
                  {advancedOpen ? (
                    <div className='grid grid-cols-1 gap-3 border-t border-[var(--semi-color-border)] p-3'>
                      {renderModelSelect('haiku_model', t('Haiku 模型'), true)}
                      {renderModelSelect(
                        'sonnet_model',
                        t('Sonnet 模型'),
                        true,
                      )}
                      {renderModelSelect('opus_model', t('Opus 模型'), true)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className='rounded-2xl border border-[var(--semi-color-primary-light-active)] bg-[var(--semi-color-primary-light-default)] p-3'>
              <div className='flex items-start gap-3'>
                <span className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--semi-color-primary)] text-white'>
                  <IconInfoCircle size='small' />
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='text-sm font-semibold text-[var(--semi-color-text-0)]'>
                    {t('需要到 CC Switch 中手动开启')}
                  </div>
                  <ol className='mt-3 flex flex-col gap-2'>
                    {activeTargetDetails.manualTaskKeys.map(
                      (taskKey, index) => (
                        <li
                          key={taskKey}
                          className='flex min-w-0 items-start gap-3 rounded-xl border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] px-3 py-2.5 text-sm text-[var(--semi-color-text-0)]'
                        >
                          <span className='flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[var(--semi-color-primary-light-default)] px-1 text-xs font-semibold text-[var(--semi-color-primary)]'>
                            {index + 1}
                          </span>
                          <span className='min-w-0 leading-5'>
                            {t(taskKey)}
                          </span>
                        </li>
                      ),
                    )}
                  </ol>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
