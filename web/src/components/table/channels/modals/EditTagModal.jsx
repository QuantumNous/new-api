/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Spinner } from '@heroui/react';
import { Bookmark, Code2, Save, Settings, User, X } from 'lucide-react';
import SideSheet from '@/components/common/ui/SideSheet';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  showWarning,
  verifyJSON,
  selectFilter,
  getChannelModels,
} from '../../../../helpers';

// ----------------------------- helpers -----------------------------

const TAG_TONE = {
  blue: 'bg-primary/15 text-primary',
};

function StatusChip({ tone = 'blue', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TAG_TONE[tone] || TAG_TONE.blue
      }`}
    >
      {children}
    </span>
  );
}

function IconTile({ tone, children }) {
  const cls =
    {
      blue: 'bg-primary/10 text-primary',
      purple:
        'bg-[color-mix(in_oklab,var(--app-primary)_8%,transparent)] text-[color-mix(in_oklab,var(--app-primary)_82%,var(--app-foreground))]',
      orange: 'bg-warning/10 text-warning',
      green: 'bg-success/10 text-success',
    }[tone] || 'bg-primary/10 text-primary';
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`}
    >
      {children}
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary';

function FieldLabel({ children }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function InfoBanner({ tone = 'info', children }) {
  const cls =
    tone === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : 'border-primary/20 bg-primary/5';
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border ${cls} px-3 py-2 text-xs text-foreground`}
    >
      <span>{children}</span>
    </div>
  );
}

// MultiSelectChips: a chip-based multi-select with a filtered dropdown.
// Mirrors the Semi `<Form.Select multiple filter allowCreate>` UX
// (chips above + search + listbox).
function MultiSelectChips({
  value = [],
  options = [],
  placeholder,
  allowCreate = false,
  filter,
  onChange,
  onSearch,
  hint,
  emptyHint,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const matcher =
      typeof filter === 'function'
        ? (option) => filter(search, option)
        : (option) => {
            const label = String(option.label ?? option.value ?? '');
            return label.toLowerCase().includes(search.toLowerCase());
          };
    return options.filter(matcher);
  }, [options, search, filter]);

  const removeAt = (val) => {
    onChange?.((value || []).filter((v) => v !== val));
  };

  const toggle = (val) => {
    if ((value || []).includes(val)) removeAt(val);
    else onChange?.([...(value || []), val]);
  };

  const handleEnter = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    if (filtered.length > 0) {
      const first = filtered[0];
      const v = first.value ?? first.label;
      if (!(value || []).includes(v)) {
        onChange?.([...(value || []), v]);
      }
      setSearch('');
      onSearch?.('');
      return;
    }
    if (allowCreate) {
      if (!(value || []).includes(trimmed)) {
        onChange?.([...(value || []), trimmed]);
      }
      setSearch('');
      onSearch?.('');
    }
  };

  return (
    <div ref={ref} className='relative'>
      <div
        className='flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 text-sm cursor-text focus-within:border-primary'
        onClick={() => setOpen(true)}
      >
        {(value || []).map((v) => (
          <span
            key={v}
            className='inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs'
          >
            <span>{v}</span>
            <button
              type='button'
              onClick={(event) => {
                event.stopPropagation();
                removeAt(v);
              }}
              aria-label='remove'
              className='text-muted hover:text-foreground'
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type='text'
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            onSearch?.(event.target.value);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleEnter();
            } else if (
              event.key === 'Backspace' &&
              search === '' &&
              (value || []).length > 0
            ) {
              removeAt((value || [])[value.length - 1]);
            }
          }}
          placeholder={(value || []).length === 0 ? placeholder : ''}
          className='flex-1 min-w-[120px] bg-transparent text-foreground outline-none placeholder:text-muted'
        />
      </div>

      {open && (
        <div className='absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-background shadow-lg'>
          {filtered.length === 0 ? (
            <div className='px-3 py-2 text-xs text-muted'>
              {emptyHint || hint}
            </div>
          ) : (
            <ul className='py-1'>
              {filtered.map((opt) => {
                const v = opt.value ?? opt.label;
                const selected = (value || []).includes(v);
                return (
                  <li key={String(v)}>
                    <button
                      type='button'
                      onClick={() => toggle(v)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-surface-secondary ${
                        selected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      <span className='truncate'>{opt.label ?? String(v)}</span>
                      {selected ? <span className='text-xs'>{'✓'}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {hint && filtered.length > 0 ? (
            <div className='border-t border-border px-3 py-2 text-xs text-muted'>
              {hint}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ----------------------------- main -----------------------------

const MODEL_MAPPING_EXAMPLE = {
  'gpt-3.5-turbo': 'gpt-3.5-turbo-0125',
};

const ORIGIN_INPUTS = {
  tag: '',
  new_tag: null,
  model_mapping: null,
  groups: [],
  models: [],
  param_override: null,
  header_override: null,
};

const EditTagModal = ({ visible, tag, handleClose, refresh }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [originModelOptions, setOriginModelOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const [modelSearchValue, setModelSearchValue] = useState('');
  const [inputs, setInputs] = useState(ORIGIN_INPUTS);

  const modelOptions = useMemo(() => {
    const opts = [...originModelOptions];
    inputs.models.forEach((model) => {
      if (!opts.find((option) => option.label === model)) {
        opts.push({ label: model, value: model });
      }
    });
    return opts;
  }, [originModelOptions, inputs.models]);

  const modelSearchMatchedCount = useMemo(() => {
    const keyword = modelSearchValue.trim();
    if (!keyword) return modelOptions.length;
    return modelOptions.reduce(
      (count, option) => count + (selectFilter(keyword, option) ? 1 : 0),
      0,
    );
  }, [modelOptions, modelSearchValue]);

  const modelSearchHintText = useMemo(() => {
    const keyword = modelSearchValue.trim();
    if (!keyword || modelSearchMatchedCount !== 0) return '';
    return t('未匹配到模型，按回车键可将「{{name}}」作为自定义模型名添加', {
      name: keyword,
    });
  }, [modelSearchMatchedCount, modelSearchValue, t]);

  const setField = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const fetchModels = async () => {
    try {
      const res = await API.get(`/api/channel/models`);
      const localModelOptions = res.data.data.map((model) => ({
        label: model.id,
        value: model.id,
      }));
      setOriginModelOptions(localModelOptions);
    } catch (error) {
      showError(error.message);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await API.get(`/api/group/`);
      if (res === undefined) return;
      setGroupOptions(
        res.data.data.map((group) => ({ label: group, value: group })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const formVals = inputs;
    const data = { tag };
    if (formVals.model_mapping) {
      if (!verifyJSON(formVals.model_mapping)) {
        showInfo('模型映射必须是合法的 JSON 格式！');
        setLoading(false);
        return;
      }
      data.model_mapping = formVals.model_mapping;
    }
    if (formVals.groups && formVals.groups.length > 0) {
      data.groups = formVals.groups.join(',');
    }
    if (formVals.models && formVals.models.length > 0) {
      data.models = formVals.models.join(',');
    }
    if (
      formVals.param_override !== undefined &&
      formVals.param_override !== null
    ) {
      if (typeof formVals.param_override !== 'string') {
        showInfo('参数覆盖必须是合法的 JSON 格式！');
        setLoading(false);
        return;
      }
      const trimmedParamOverride = formVals.param_override.trim();
      if (trimmedParamOverride !== '' && !verifyJSON(trimmedParamOverride)) {
        showInfo('参数覆盖必须是合法的 JSON 格式！');
        setLoading(false);
        return;
      }
      data.param_override = trimmedParamOverride;
    }
    if (
      formVals.header_override !== undefined &&
      formVals.header_override !== null
    ) {
      if (typeof formVals.header_override !== 'string') {
        showInfo('请求头覆盖必须是合法的 JSON 格式！');
        setLoading(false);
        return;
      }
      const trimmedHeaderOverride = formVals.header_override.trim();
      if (trimmedHeaderOverride !== '' && !verifyJSON(trimmedHeaderOverride)) {
        showInfo('请求头覆盖必须是合法的 JSON 格式！');
        setLoading(false);
        return;
      }
      data.header_override = trimmedHeaderOverride;
    }
    data.new_tag = formVals.new_tag;
    if (
      data.model_mapping === undefined &&
      data.groups === undefined &&
      data.models === undefined &&
      data.new_tag === undefined &&
      data.param_override === undefined &&
      data.header_override === undefined
    ) {
      showWarning('没有任何修改！');
      setLoading(false);
      return;
    }
    try {
      const res = await API.put('/api/channel/tag', data);
      if (res?.data?.success) {
        showSuccess('标签更新成功！');
        refresh();
        handleClose();
      }
    } catch (error) {
      showError(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!visible) return;
    const fetchTagModels = async () => {
      if (!tag) return;
      setLoading(true);
      try {
        const res = await API.get(`/api/channel/tag/models?tag=${tag}`);
        if (res?.data?.success) {
          const models = res.data.data ? res.data.data.split(',') : [];
          setInputs((prev) => ({ ...prev, models }));
        } else {
          showError(res.data.message);
        }
      } catch (error) {
        showError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchModels().then();
    fetchGroups().then();
    fetchTagModels().then();
    setModelSearchValue('');
    setInputs({ ...ORIGIN_INPUTS, tag: tag, new_tag: tag });
  }, [visible, tag]);

  // ESC-to-close
  useEffect(() => {
    if (!visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') handleClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, handleClose]);

  const addCustomModels = () => {
    const trimmed = customModel.trim();
    if (trimmed === '') return;
    const modelArray = trimmed.split(',').map((model) => model.trim());

    const localModels = [...inputs.models];
    const addedModels = [];

    modelArray.forEach((model) => {
      if (model && !localModels.includes(model)) {
        localModels.push(model);
        addedModels.push(model);
      }
    });

    setCustomModel('');
    setField('models', localModels);

    if (addedModels.length > 0) {
      showSuccess(
        t('已新增 {{count}} 个模型：{{list}}', {
          count: addedModels.length,
          list: addedModels.join(', '),
        }),
      );
    } else {
      showInfo(t('未发现新增模型'));
    }
  };

  return (
    <SideSheet
      visible={visible}
      onClose={handleClose}
      placement='right'
      width={600}
    >
        <header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
          <div className='flex items-center gap-2'>
            <StatusChip tone='blue'>{t('编辑')}</StatusChip>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {t('编辑标签')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            aria-label={t('关闭')}
            onPress={handleClose}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='relative flex-1 overflow-y-auto p-3'>
          {loading && (
            <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
              <Spinner color='primary' />
            </div>
          )}

          <div className='space-y-3'>
            {/* 标签信息 */}
            <Card className='!rounded-2xl border-0 shadow-sm'>
              <Card.Content className='space-y-4 p-5'>
                <div className='flex items-center gap-2'>
                  <IconTile tone='blue'>
                    <Bookmark size={16} />
                  </IconTile>
                  <div>
                    <div className='text-base font-semibold text-foreground'>
                      {t('标签信息')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t('标签的基本配置')}
                    </div>
                  </div>
                </div>

                <InfoBanner tone='warning'>
                  {t('所有编辑均为覆盖操作，留空则不更改')}
                </InfoBanner>

                <div className='space-y-2'>
                  <FieldLabel>{t('标签名称')}</FieldLabel>
                  <input
                    type='text'
                    value={inputs.new_tag ?? ''}
                    onChange={(event) =>
                      setField('new_tag', event.target.value)
                    }
                    placeholder={t('请输入新标签，留空则解散标签')}
                    className={inputClass}
                  />
                </div>
              </Card.Content>
            </Card>

            {/* 模型配置 */}
            <Card className='!rounded-2xl border-0 shadow-sm'>
              <Card.Content className='space-y-4 p-5'>
                <div className='flex items-center gap-2'>
                  <IconTile tone='purple'>
                    <Code2 size={16} />
                  </IconTile>
                  <div>
                    <div className='text-base font-semibold text-foreground'>
                      {t('模型配置')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t('模型选择和映射设置')}
                    </div>
                  </div>
                </div>

                <InfoBanner>
                  {t(
                    '当前模型列表为该标签下所有渠道模型列表最长的一个，并非所有渠道的并集，请注意可能导致某些渠道模型丢失。',
                  )}
                </InfoBanner>

                <div className='space-y-2'>
                  <FieldLabel>{t('模型')}</FieldLabel>
                  <MultiSelectChips
                    value={inputs.models}
                    options={modelOptions}
                    placeholder={t('请选择该渠道所支持的模型，留空则不更改')}
                    filter={selectFilter}
                    allowCreate
                    onChange={(v) => setField('models', v)}
                    onSearch={setModelSearchValue}
                    hint={modelSearchHintText || undefined}
                    emptyHint={modelSearchHintText}
                  />
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('自定义模型名称')}</FieldLabel>
                  <div className='flex items-center gap-2'>
                    <input
                      type='text'
                      value={customModel}
                      onChange={(event) =>
                        setCustomModel(event.target.value.trim())
                      }
                      placeholder={t('输入自定义模型名称')}
                      className={inputClass}
                    />
                    <Button color='primary' onPress={addCustomModels}>
                      {t('填入')}
                    </Button>
                  </div>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('模型重定向')}</FieldLabel>
                  <textarea
                    rows={4}
                    value={inputs.model_mapping ?? ''}
                    onChange={(event) =>
                      setField('model_mapping', event.target.value)
                    }
                    placeholder={t(
                      '此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，留空则不更改',
                    )}
                    className={textareaClass}
                  />
                  <div className='flex flex-wrap gap-3 text-xs'>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() =>
                        setField(
                          'model_mapping',
                          JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2),
                        )
                      }
                    >
                      {t('填入模板')}
                    </button>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() =>
                        setField('model_mapping', JSON.stringify({}, null, 2))
                      }
                    >
                      {t('清空重定向')}
                    </button>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() => setField('model_mapping', '')}
                    >
                      {t('不更改')}
                    </button>
                  </div>
                </div>
              </Card.Content>
            </Card>

            {/* 高级设置 */}
            <Card className='!rounded-2xl border-0 shadow-sm'>
              <Card.Content className='space-y-4 p-5'>
                <div className='flex items-center gap-2'>
                  <IconTile tone='orange'>
                    <Settings size={16} />
                  </IconTile>
                  <div>
                    <div className='text-base font-semibold text-foreground'>
                      {t('高级设置')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t('渠道的高级配置选项')}
                    </div>
                  </div>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('参数覆盖')}</FieldLabel>
                  <textarea
                    rows={6}
                    value={inputs.param_override ?? ''}
                    onChange={(event) =>
                      setField('param_override', event.target.value)
                    }
                    placeholder={
                      t('此项可选，用于覆盖请求参数。不支持覆盖 stream 参数') +
                      '\n' +
                      t('旧格式（直接覆盖）：') +
                      '\n{\n  "temperature": 0,\n  "max_tokens": 1000\n}' +
                      '\n\n' +
                      t('新格式（支持条件判断与json自定义）：') +
                      '\n{\n  "operations": [\n    {\n      "path": "temperature",\n      "mode": "set",\n      "value": 0.7,\n      "conditions": [\n        {\n          "path": "model",\n          "mode": "prefix",\n          "value": "gpt"\n        }\n      ]\n    }\n  ]\n}'
                    }
                    className={textareaClass}
                  />
                  <div className='flex flex-wrap gap-3 text-xs'>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() =>
                        setField(
                          'param_override',
                          JSON.stringify({ temperature: 0 }, null, 2),
                        )
                      }
                    >
                      {t('旧格式模板')}
                    </button>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() =>
                        setField(
                          'param_override',
                          JSON.stringify(
                            {
                              operations: [
                                {
                                  path: 'temperature',
                                  mode: 'set',
                                  value: 0.7,
                                  conditions: [
                                    {
                                      path: 'model',
                                      mode: 'prefix',
                                      value: 'gpt',
                                    },
                                  ],
                                  logic: 'AND',
                                },
                              ],
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      {t('新格式模板')}
                    </button>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() => setField('param_override', null)}
                    >
                      {t('不更改')}
                    </button>
                  </div>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('请求头覆盖')}</FieldLabel>
                  <textarea
                    rows={5}
                    value={inputs.header_override ?? ''}
                    onChange={(event) =>
                      setField('header_override', event.target.value)
                    }
                    placeholder={
                      t('此项可选，用于覆盖请求头参数') +
                      '\n' +
                      t('格式示例：') +
                      '\n{\n  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",\n  "Authorization": "Bearer {api_key}"\n}'
                    }
                    className={textareaClass}
                  />
                  <div className='flex flex-wrap gap-3 text-xs'>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() =>
                        setField(
                          'header_override',
                          JSON.stringify(
                            {
                              'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
                              Authorization: 'Bearer {api_key}',
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      {t('填入模板')}
                    </button>
                    <button
                      type='button'
                      className='cursor-pointer text-primary hover:underline'
                      onClick={() => setField('header_override', null)}
                    >
                      {t('不更改')}
                    </button>
                  </div>
                  <FieldHint>
                    {t('支持变量：')}{' '}
                    <span className='ml-1 text-foreground'>
                      {t('渠道密钥')}: {'{api_key}'}
                    </span>
                  </FieldHint>
                </div>
              </Card.Content>
            </Card>

            {/* 分组设置 */}
            <Card className='!rounded-2xl border-0 shadow-sm'>
              <Card.Content className='space-y-4 p-5'>
                <div className='flex items-center gap-2'>
                  <IconTile tone='green'>
                    <User size={16} />
                  </IconTile>
                  <div>
                    <div className='text-base font-semibold text-foreground'>
                      {t('分组设置')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t('用户分组配置')}
                    </div>
                  </div>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('分组')}</FieldLabel>
                  <MultiSelectChips
                    value={inputs.groups}
                    options={groupOptions}
                    placeholder={t('请选择可以使用该渠道的分组，留空则不更改')}
                    allowCreate
                    onChange={(v) => setField('groups', v)}
                  />
                  <FieldHint>
                    {t('请在系统设置页面编辑分组倍率以添加新的分组：')}
                  </FieldHint>
                </div>
              </Card.Content>
            </Card>
          </div>
        </div>

        <footer className='flex justify-end gap-2 border-t border-border bg-background px-5 py-3'>
          <Button variant='tertiary' onPress={handleClose}>
            <X size={14} />
            {t('取消')}
          </Button>
          <Button color='primary' isPending={loading} onPress={handleSave}>
            <Save size={14} />
            {t('保存')}
          </Button>
        </footer>
    </SideSheet>
  );
};

export default EditTagModal;
