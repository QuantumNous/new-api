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

import React, { useEffect, useState, useMemo } from 'react';
import JSONEditor from '../../../common/ui/JSONEditor';
import {
  Alert,
  Button,
  Card,
  Input,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextArea,
} from '@heroui/react';
import { AlertTriangle, ChevronDown, ExternalLink, X } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import SideSheet from '../../../common/ui/SideSheet';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
};

function StatusChip({ tone, children }) {
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

// Visual baseline shared by every form field inside the side sheet so
// HeroUI Input / TextArea / Select.Trigger all sit on the same 40px
// rounded-xl bordered surface.
const inputClass =
  '!h-10 w-full !rounded-xl !border !border-border !bg-background !px-3 !text-sm !text-foreground outline-none transition focus:!border-primary disabled:opacity-50';

const textareaClass =
  '!w-full !rounded-xl !border !border-border !bg-background !px-3 !py-2 !text-sm !text-foreground outline-none transition focus:!border-primary';

// Sentinel matching FilterSelect — HeroUI Select treats empty / null
// `selectedKey` as "no selection" and renders the placeholder. Map our
// optional empty-state through a sentinel so we can keep state in sync.
const SELECT_EMPTY_KEY = '__edit_model_empty__';
const toSelectKey = (value) => {
  if (value === undefined || value === null || value === '') {
    return SELECT_EMPTY_KEY;
  }
  return String(value);
};
const fromSelectKey = (key) => {
  if (key === null || key === undefined || key === SELECT_EMPTY_KEY) {
    return '';
  }
  return String(key);
};

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function FieldError({ children }) {
  if (!children) return null;
  return <div className='mt-1 text-xs text-danger'>{children}</div>;
}

// Example endpoint template for quick fill
const ENDPOINT_TEMPLATE = {
  openai: { path: '/v1/chat/completions', method: 'POST' },
  'openai-response': { path: '/v1/responses', method: 'POST' },
  'openai-response-compact': { path: '/v1/responses/compact', method: 'POST' },
  anthropic: { path: '/v1/messages', method: 'POST' },
  gemini: { path: '/v1beta/models/{model}:generateContent', method: 'POST' },
  'jina-rerank': { path: '/v1/rerank', method: 'POST' },
  'image-generation': { path: '/v1/images/generations', method: 'POST' },
};

const NAME_RULE_OPTIONS = [
  { label: '精确名称匹配', value: 0 },
  { label: '前缀名称匹配', value: 1 },
  { label: '包含名称匹配', value: 2 },
  { label: '后缀名称匹配', value: 3 },
];

const buildInitValues = (editingModel) => ({
  model_name: editingModel?.model_name || '',
  description: '',
  icon: '',
  tags: [],
  vendor_id: undefined,
  vendor: '',
  vendor_icon: '',
  endpoints: '',
  // 通过未配置模型过来的固定为精确匹配
  name_rule: editingModel?.model_name ? 0 : undefined,
  status: true,
  sync_official: true,
});

// Controlled tag input. The chip-removal buttons are HeroUI Buttons
// (icon-only, ghost) so they pick up the design system's focus ring;
// the inner editor is a bare `<input>` because nesting an `<Input>`
// element inside this composite container would inherit Input's own
// padding/border and break the wrapper's 40px-tall pill rhythm.
function TagInput({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const commit = (raw) => {
    const next = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...new Set([...tags, ...next])];
    onChange?.(merged);
    setDraft('');
  };

  const removeAt = (index) => {
    const next = tags.filter((_, i) => i !== index);
    onChange?.(next);
  };

  return (
    <div className='flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 text-sm focus-within:border-primary'>
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className='inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs'
        >
          <span>{tag}</span>
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            aria-label='remove'
            onPress={() => removeAt(idx)}
            className='!h-4 !w-4 !min-w-4 !rounded-full text-muted hover:!text-foreground [&_svg]:!size-3'
          >
            <X size={10} />
          </Button>
        </span>
      ))}
      <input
        type='text'
        value={draft}
        onChange={(event) => {
          const v = event.target.value;
          if (v.endsWith(',')) {
            commit(v.slice(0, -1));
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(draft);
          } else if (
            event.key === 'Backspace' &&
            draft === '' &&
            tags.length > 0
          ) {
            removeAt(tags.length - 1);
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className='flex-1 min-w-[120px] bg-transparent text-foreground outline-none placeholder:text-muted'
      />
    </div>
  );
}

const EditModelModal = (props) => {
  const { t } = useTranslation();
  const isEdit = props.editingModel && props.editingModel.id !== undefined;
  const placement = useMemo(() => (isEdit ? 'right' : 'left'), [isEdit]);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState(buildInitValues(props.editingModel));
  const [errors, setErrors] = useState({});

  // 供应商列表
  const [vendors, setVendors] = useState([]);
  // 预填组（标签、端点）
  const [tagGroups, setTagGroups] = useState([]);
  const [endpointGroups, setEndpointGroups] = useState([]);

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = () => {
    setValues(buildInitValues(props.editingModel));
    setErrors({});
  };

  const fetchVendors = async () => {
    try {
      const res = await API.get('/api/vendors/?page_size=1000');
      if (res.data.success) {
        const items = res.data.data.items || res.data.data || [];
        setVendors(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      // ignore
    }
  };

  const fetchPrefillGroups = async () => {
    try {
      const [tagRes, endpointRes] = await Promise.all([
        API.get('/api/prefill_group?type=tag'),
        API.get('/api/prefill_group?type=endpoint'),
      ]);
      if (tagRes?.data?.success) {
        setTagGroups(tagRes.data.data || []);
      }
      if (endpointRes?.data?.success) {
        setEndpointGroups(endpointRes.data.data || []);
      }
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    if (props.visiable) {
      fetchVendors();
      fetchPrefillGroups();
    }
  }, [props.visiable]);

  const loadModel = async () => {
    if (!isEdit || !props.editingModel.id) return;

    setLoading(true);
    try {
      const res = await API.get(`/api/models/${props.editingModel.id}`);
      const { success, message, data } = res.data || {};
      if (success && data) {
        const tags =
          typeof data.tags === 'string' && data.tags
            ? data.tags.split(',').filter(Boolean)
            : Array.isArray(data.tags)
              ? data.tags
              : [];
        setValues({
          ...buildInitValues(props.editingModel),
          ...data,
          tags,
          endpoints: data.endpoints || '',
          status: data.status === 1,
          sync_official: (data.sync_official ?? 1) === 1,
        });
        setErrors({});
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('加载模型信息失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (props.visiable) {
      if (isEdit) {
        loadModel();
      } else {
        reset();
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visiable, props.editingModel?.id, props.editingModel?.model_name]);

  // ESC-to-close
  useEffect(() => {
    if (!props.visiable) return;
    const onKey = (event) => {
      if (event.key === 'Escape') props.handleClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.visiable, props.handleClose]);

  const validate = () => {
    const next = {};
    if (!values.model_name?.trim()) {
      next.model_name = t('请输入模型名称');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const submitData = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags.join(',') : values.tags,
        endpoints: values.endpoints || '',
        status: values.status ? 1 : 0,
        sync_official: values.sync_official ? 1 : 0,
      };

      if (isEdit) {
        submitData.id = props.editingModel.id;
        const res = await API.put('/api/models/', submitData);
        const { success, message } = res.data || {};
        if (success) {
          showSuccess(t('模型更新成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(t(message));
        }
      } else {
        const res = await API.post('/api/models/', submitData);
        const { success, message } = res.data || {};
        if (success) {
          showSuccess(t('模型创建成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(t(message));
        }
      }
    } catch (error) {
      showError(error.response?.data?.message || t('操作失败'));
    }
    setLoading(false);
    reset();
  };

  return (
    <SideSheet
      visible={props.visiable}
      onClose={props.handleClose}
      placement={placement}
      width={480}
    >
        <header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
          <div className='flex items-center gap-2'>
            <StatusChip tone={isEdit ? 'blue' : 'green'}>
              {isEdit ? t('更新') : t('新建')}
            </StatusChip>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {isEdit ? t('更新模型信息') : t('创建新的模型')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            aria-label={t('关闭')}
            onPress={props.handleClose}
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

          <Card className='!rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              {/* Section header — icon tile removed per UX request; the
                  title + subtitle alone gives enough visual hierarchy
                  inside the side sheet's single-card layout. */}
              <div>
                <div className='text-base font-semibold text-foreground'>
                  {t('基本信息')}
                </div>
                <div className='text-xs text-muted'>
                  {t('设置模型的基本信息')}
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('模型名称')}</FieldLabel>
                  <Input
                    type='text'
                    value={values.model_name || ''}
                    onChange={(event) =>
                      setField('model_name')(event.target.value)
                    }
                    placeholder={t('请输入模型名称，如：gpt-4')}
                    aria-label={t('模型名称')}
                    className={inputClass}
                  />
                  <FieldError>{errors.model_name}</FieldError>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('名称匹配类型')}</FieldLabel>
                  <Select
                    aria-label={t('名称匹配类型')}
                    placeholder={t('请选择名称匹配类型')}
                    selectedKey={toSelectKey(values.name_rule)}
                    onSelectionChange={(key) => {
                      const raw = fromSelectKey(key);
                      setField('name_rule')(
                        raw === '' ? undefined : Number(raw),
                      );
                    }}
                  >
                    <Select.Trigger
                      className={`${inputClass} flex items-center justify-between gap-2 cursor-pointer text-left`}
                    >
                      <Select.Value className='truncate' />
                      <Select.Indicator>
                        <ChevronDown size={14} className='text-muted' />
                      </Select.Indicator>
                    </Select.Trigger>
                    <Select.Popover className='min-w-(--trigger-width)'>
                      <ListBox>
                        {NAME_RULE_OPTIONS.map((o) => (
                          <ListBox.Item
                            key={String(o.value)}
                            id={String(o.value)}
                            textValue={t(o.label)}
                          >
                            {t(o.label)}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('模型图标')}</FieldLabel>
                  <Input
                    type='text'
                    value={values.icon || ''}
                    onChange={(event) => setField('icon')(event.target.value)}
                    placeholder={t('请输入图标名称')}
                    aria-label={t('模型图标')}
                    className={inputClass}
                  />
                  <div className='mt-1.5 text-xs text-muted'>
                    {t(
                      "图标使用@lobehub/icons库，如：OpenAI、Claude.Color，支持链式参数：OpenAI.Avatar.type={'platform'}、OpenRouter.Avatar.shape={'square'}，查询所有可用图标请 ",
                    )}
                    <a
                      href='https://icons.lobehub.com/components/lobe-hub'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline'
                    >
                      {t('请点击我')}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('描述')}</FieldLabel>
                  <TextArea
                    value={values.description || ''}
                    onChange={(event) =>
                      setField('description')(event.target.value)
                    }
                    placeholder={t('请输入模型描述')}
                    rows={3}
                    aria-label={t('描述')}
                    className={textareaClass}
                  />
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('标签')}</FieldLabel>
                  <TagInput
                    value={values.tags}
                    onChange={setField('tags')}
                    placeholder={t('输入标签或使用","分隔多个标签')}
                  />
                  {tagGroups.length > 0 && (
                    <div className='flex flex-wrap gap-1.5 pt-1'>
                      {tagGroups.map((group) => (
                        <Button
                          key={group.id}
                          size='sm'
                          variant='tertiary'
                          onPress={() => {
                            const merged = [
                              ...new Set([
                                ...(values.tags || []),
                                ...(group.items || []),
                              ]),
                            ];
                            setField('tags')(merged);
                          }}
                        >
                          {group.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('供应商')}</FieldLabel>
                  <Select
                    aria-label={t('供应商')}
                    placeholder={t('选择模型供应商')}
                    selectedKey={toSelectKey(values.vendor_id)}
                    onSelectionChange={(key) => {
                      const raw = fromSelectKey(key);
                      const id = raw === '' ? undefined : Number(raw);
                      const vendorInfo = vendors.find((v) => v.id === id);
                      setValues((prev) => ({
                        ...prev,
                        vendor_id: id,
                        vendor: vendorInfo?.name ?? '',
                      }));
                    }}
                  >
                    <Select.Trigger
                      className={`${inputClass} flex items-center justify-between gap-2 cursor-pointer text-left`}
                    >
                      <Select.Value className='truncate' />
                      <Select.Indicator>
                        <ChevronDown size={14} className='text-muted' />
                      </Select.Indicator>
                    </Select.Trigger>
                    <Select.Popover className='min-w-(--trigger-width)'>
                      <ListBox>
                        {vendors.map((v) => (
                          <ListBox.Item
                            key={String(v.id)}
                            id={String(v.id)}
                            textValue={v.name}
                          >
                            {v.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Endpoints showcase warning — HeroUI Alert keeps the
                    color tone consistent with the page-level notice on
                    /console/models. Same density tweaks: vertical
                    centering + 12px description text. */}
                <Alert
                  status='warning'
                  className='!items-center ct-compact-alert'
                >
                  <Alert.Indicator>
                    <AlertTriangle size={14} />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Description>
                      {t(
                        '提示：此处配置仅用于控制「模型广场」对用户的展示效果，不会影响模型的实际调用与路由。若需配置真实调用行为，请前往「渠道管理」进行设置。',
                      )}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>

                <JSONEditor
                  field='endpoints'
                  label={t('在模型广场向用户展示的端点')}
                  placeholder={
                    '{\n  "openai": {"path": "/v1/chat/completions", "method": "POST"}\n}'
                  }
                  value={values.endpoints}
                  onChange={(val) => setField('endpoints')(val)}
                  editorType='object'
                  template={ENDPOINT_TEMPLATE}
                  templateLabel={t('填入模板')}
                  extraText={t('留空则使用默认端点；支持 {path, method}')}
                  extraFooter={
                    endpointGroups.length > 0 && (
                      <div className='flex flex-wrap gap-1.5'>
                        {endpointGroups.map((group) => (
                          <Button
                            key={group.id}
                            size='sm'
                            variant='tertiary'
                            onPress={() => {
                              try {
                                const current = values.endpoints || '';
                                let base = {};
                                if (current && current.trim()) {
                                  base = JSON.parse(current);
                                }
                                const groupObj =
                                  typeof group.items === 'string'
                                    ? JSON.parse(group.items || '{}')
                                    : group.items || {};
                                const merged = { ...base, ...groupObj };
                                setField('endpoints')(
                                  JSON.stringify(merged, null, 2),
                                );
                              } catch (e) {
                                try {
                                  const groupObj =
                                    typeof group.items === 'string'
                                      ? JSON.parse(group.items || '{}')
                                      : group.items || {};
                                  setField('endpoints')(
                                    JSON.stringify(groupObj, null, 2),
                                  );
                                } catch {}
                              }
                            }}
                          >
                            {group.name}
                          </Button>
                        ))}
                      </div>
                    )
                  }
                />

                <label className='flex items-center justify-between gap-3'>
                  <div>
                    <div className='text-sm font-medium text-foreground'>
                      {t('参与官方同步')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t('关闭后，此模型将不会被"同步官方"自动覆盖或创建')}
                    </div>
                  </div>
                  <Switch
                    isSelected={values.sync_official}
                    onValueChange={setField('sync_official')}
                    size='md'
                    aria-label={t('参与官方同步')}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </label>

                <label className='flex items-center justify-between gap-3'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('状态')}
                  </div>
                  <Switch
                    isSelected={values.status}
                    onValueChange={setField('status')}
                    size='md'
                    aria-label={t('状态')}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </label>
              </div>
            </Card.Content>
          </Card>
        </div>

        <footer className='flex justify-end gap-2 border-t border-border bg-background px-5 py-3'>
          <Button variant='tertiary' onPress={props.handleClose}>
            {t('取消')}
          </Button>
          <Button color='primary' isPending={loading} onPress={submit}>
            {t('提交')}
          </Button>
        </footer>
    </SideSheet>
  );
};

export default EditModelModal;
