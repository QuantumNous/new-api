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
import { Button, Card, Spinner, Switch } from '@heroui/react';
import { AlertTriangle, ExternalLink, FileText, Save, X } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

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

function IconTile({ tone, children }) {
  const cls =
    {
      blue: 'bg-primary/10 text-primary',
      green: 'bg-success/10 text-success',
    }[tone] || 'bg-success/10 text-success';
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
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

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

// Replaces Semi `<Form.TagInput>` with a controlled tag input that
// commits on Enter / `,` / blur.
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
    <div className='flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 text-sm focus-within:border-primary'>
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className='inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs'
        >
          <span>{tag}</span>
          <button
            type='button'
            onClick={() => removeAt(idx)}
            aria-label='remove'
            className='text-muted hover:text-foreground'
          >
            <X size={12} />
          </button>
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
  const isMobile = useIsMobile();
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

  const slideClose =
    placement === 'right' ? 'translate-x-full' : '-translate-x-full';
  const positionClass =
    placement === 'right'
      ? 'fixed bottom-0 right-0 top-0'
      : 'fixed bottom-0 left-0 top-0';

  return (
    <>
      <div
        aria-hidden={!props.visiable}
        onClick={props.handleClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          props.visiable ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!props.visiable}
        style={{ width: isMobile ? '100%' : 600 }}
        className={`${positionClass} z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          props.visiable ? 'translate-x-0' : slideClose
        }`}
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
              <div className='flex items-center gap-2'>
                <IconTile tone='green'>
                  <FileText size={16} />
                </IconTile>
                <div>
                  <div className='text-base font-semibold text-foreground'>
                    {t('基本信息')}
                  </div>
                  <div className='text-xs text-muted'>
                    {t('设置模型的基本信息')}
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('模型名称')}</FieldLabel>
                  <input
                    type='text'
                    value={values.model_name || ''}
                    onChange={(event) =>
                      setField('model_name')(event.target.value)
                    }
                    placeholder={t('请输入模型名称，如：gpt-4')}
                    className={inputClass}
                  />
                  <FieldError>{errors.model_name}</FieldError>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('名称匹配类型')}</FieldLabel>
                  <select
                    value={
                      values.name_rule === undefined
                        ? ''
                        : String(values.name_rule)
                    }
                    onChange={(event) => {
                      const v = event.target.value;
                      setField('name_rule')(v === '' ? undefined : Number(v));
                    }}
                    className={inputClass}
                  >
                    <option value=''>{t('请选择名称匹配类型')}</option>
                    {NAME_RULE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.label)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('模型图标')}</FieldLabel>
                  <input
                    type='text'
                    value={values.icon || ''}
                    onChange={(event) => setField('icon')(event.target.value)}
                    placeholder={t('请输入图标名称')}
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
                  <textarea
                    value={values.description || ''}
                    onChange={(event) =>
                      setField('description')(event.target.value)
                    }
                    placeholder={t('请输入模型描述')}
                    rows={3}
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
                  <select
                    value={values.vendor_id ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const id = raw === '' ? undefined : Number(raw);
                      const vendorInfo = vendors.find((v) => v.id === id);
                      setValues((prev) => ({
                        ...prev,
                        vendor_id: id,
                        vendor: vendorInfo?.name ?? '',
                      }));
                    }}
                    className={inputClass}
                  >
                    <option value=''>{t('选择模型供应商')}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Endpoints showcase warning */}
                <div className='flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-foreground'>
                  <AlertTriangle
                    size={16}
                    className='mt-0.5 shrink-0 text-warning'
                  />
                  <span>
                    {t(
                      '提示：此处配置仅用于控制「模型广场」对用户的展示效果，不会影响模型的实际调用与路由。若需配置真实调用行为，请前往「渠道管理」进行设置。',
                    )}
                  </span>
                </div>

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
            <X size={14} />
            {t('取消')}
          </Button>
          <Button color='primary' isPending={loading} onPress={submit}>
            <Save size={14} />
            {t('提交')}
          </Button>
        </footer>
      </aside>
    </>
  );
};

export default EditModelModal;
