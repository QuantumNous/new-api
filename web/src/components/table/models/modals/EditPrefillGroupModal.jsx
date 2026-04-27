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

import React, { useEffect, useState } from 'react';
import { Button, Card, Input } from '@heroui/react';
import { Layers, Save, X } from 'lucide-react';
import JSONEditor from '../../../common/ui/JSONEditor';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const ENDPOINT_TEMPLATE = {
  openai: { path: '/v1/chat/completions', method: 'POST' },
  'openai-response': { path: '/v1/responses', method: 'POST' },
  'openai-response-compact': { path: '/v1/responses/compact', method: 'POST' },
  anthropic: { path: '/v1/messages', method: 'POST' },
  gemini: { path: '/v1beta/models/{model}:generateContent', method: 'POST' },
  'jina-rerank': { path: '/v1/rerank', method: 'POST' },
  'image-generation': { path: '/v1/images/generations', method: 'POST' },
};

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';
const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';
const selectClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

function TagInput({ value = [], onChange, placeholder, ariaLabel }) {
  const [draft, setDraft] = useState('');
  const items = Array.isArray(value) ? value : [];

  const commit = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return;
    if (items.includes(text)) {
      setDraft('');
      return;
    }
    onChange?.([...items, text]);
    setDraft('');
  };

  const remove = (idx) => {
    const next = items.slice();
    next.splice(idx, 1);
    onChange?.(next);
  };

  return (
    <div
      className='flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-lg border border-[color:var(--app-border)] bg-background px-2 py-1 text-sm transition focus-within:border-primary'
      aria-label={ariaLabel}
    >
      {items.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className='inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
        >
          {tag}
          <button
            type='button'
            onClick={() => remove(idx)}
            aria-label={`remove ${tag}`}
            className='inline-flex h-3 w-3 items-center justify-center text-sky-500 hover:text-sky-700'
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        type='text'
        value={draft}
        placeholder={items.length === 0 ? placeholder : ''}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit(draft);
          } else if (
            event.key === 'Backspace' &&
            !draft &&
            items.length > 0
          ) {
            remove(items.length - 1);
          }
        }}
        onBlur={() => commit(draft)}
        className='min-w-[8rem] flex-1 bg-transparent py-1 text-sm text-foreground outline-none'
      />
    </div>
  );
}

const EditPrefillGroupModal = ({
  visible,
  onClose,
  editingGroup,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);

  const isEdit = editingGroup && editingGroup.id !== undefined;

  const buildInitial = () => ({
    name: editingGroup?.name || '',
    type: editingGroup?.type || 'tag',
    description: editingGroup?.description || '',
    items: (() => {
      try {
        if (editingGroup?.type === 'endpoint') {
          return typeof editingGroup?.items === 'string'
            ? editingGroup.items
            : JSON.stringify(editingGroup.items || {}, null, 2);
        }
        return Array.isArray(editingGroup?.items) ? editingGroup.items : [];
      } catch {
        return editingGroup?.type === 'endpoint' ? '' : [];
      }
    })(),
  });

  const [values, setValues] = useState(buildInitial);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setValues(buildInitial());
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingGroup?.id, editingGroup?.type]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleTypeChange = (next) => {
    // Reset items when switching item shape (string vs array).
    setValues((prev) => ({
      ...prev,
      type: next,
      items: next === 'endpoint' ? '' : [],
    }));
  };

  const validate = () => {
    const next = {};
    if (!values.name?.trim()) next.name = t('请输入组名');
    if (!values.type) next.type = t('请选择组类型');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const submitData = { ...values };
      if (values.type === 'endpoint') {
        submitData.items = values.items || '';
      } else {
        submitData.items = Array.isArray(values.items) ? values.items : [];
      }

      if (editingGroup?.id) {
        submitData.id = editingGroup.id;
        const res = await API.put('/api/prefill_group', submitData);
        if (res.data?.success) {
          showSuccess(t('更新成功'));
          onSuccess?.();
        } else {
          showError(res.data?.message || t('更新失败'));
        }
      } else {
        const res = await API.post('/api/prefill_group', submitData);
        if (res.data?.success) {
          showSuccess(t('创建成功'));
          onSuccess?.();
        } else {
          showError(res.data?.message || t('创建失败'));
        }
      }
    } catch (error) {
      showError(t('操作失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        aria-hidden={!visible}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!visible}
        style={{ width: isMobile ? '100%' : 600 }}
        className={`fixed bottom-0 left-0 top-0 z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-5 py-3'>
          <div className='flex items-center gap-2'>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isEdit
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {isEdit ? t('更新') : t('新建')}
            </span>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {isEdit ? t('更新预填组') : t('创建新的预填组')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='light'
            size='sm'
            aria-label={t('关闭')}
            onPress={onClose}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='flex-1 overflow-y-auto p-3'>
          <Card className='!rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div className='flex items-center gap-2'>
                <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'>
                  <Layers size={16} />
                </div>
                <div>
                  <div className='text-base font-semibold text-foreground'>
                    {t('基本信息')}
                  </div>
                  <div className='text-xs text-muted'>
                    {t('设置预填组的基本信息')}
                  </div>
                </div>
              </div>

              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('组名')}
                  <span className='ml-1 text-red-500'>*</span>
                </div>
                <Input
                  type='text'
                  value={values.name}
                  onChange={(event) => setField('name')(event.target.value)}
                  placeholder={t('请输入组名')}
                  aria-label={t('组名')}
                  className={inputClass}
                />
                {errors.name ? (
                  <div className='text-xs text-red-600'>{errors.name}</div>
                ) : null}
              </div>

              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('类型')}
                  <span className='ml-1 text-red-500'>*</span>
                </div>
                <select
                  value={values.type}
                  onChange={(event) => handleTypeChange(event.target.value)}
                  aria-label={t('类型')}
                  className={selectClass}
                >
                  <option value='model'>{t('模型组')}</option>
                  <option value='tag'>{t('标签组')}</option>
                  <option value='endpoint'>{t('端点组')}</option>
                </select>
                {errors.type ? (
                  <div className='text-xs text-red-600'>{errors.type}</div>
                ) : null}
              </div>

              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('描述')}
                </div>
                <textarea
                  value={values.description}
                  onChange={(event) =>
                    setField('description')(event.target.value)
                  }
                  placeholder={t('请输入组描述')}
                  rows={3}
                  aria-label={t('描述')}
                  className={textareaClass}
                />
              </div>

              <div className='space-y-2'>
                {values.type === 'endpoint' ? (
                  <JSONEditor
                    field='items'
                    label={t('端点映射')}
                    value={
                      typeof values.items === 'string'
                        ? values.items
                        : JSON.stringify(values.items || {}, null, 2)
                    }
                    onChange={(val) => setField('items')(val)}
                    editorType='object'
                    placeholder={
                      '{\n  "openai": {"path": "/v1/chat/completions", "method": "POST"}\n}'
                    }
                    template={ENDPOINT_TEMPLATE}
                    templateLabel={t('填入模板')}
                    extraText={t('键为端点类型，值为路径和方法对象')}
                  />
                ) : (
                  <>
                    <div className='text-sm font-medium text-foreground'>
                      {t('项目')}
                    </div>
                    <TagInput
                      value={Array.isArray(values.items) ? values.items : []}
                      onChange={(next) => setField('items')(next)}
                      placeholder={t('输入项目名称，按回车添加')}
                      ariaLabel={t('项目')}
                    />
                  </>
                )}
              </div>
            </Card.Content>
          </Card>
        </div>

        <footer className='flex justify-end gap-2 border-t border-[color:var(--app-border)] bg-[color:var(--app-background)] px-5 py-3'>
          <Button
            variant='light'
            onPress={onClose}
            startContent={<X size={14} />}
          >
            {t('取消')}
          </Button>
          <Button
            color='primary'
            onPress={handleSubmit}
            isPending={loading}
            startContent={<Save size={14} />}
          >
            {t('提交')}
          </Button>
        </footer>
      </aside>
    </>
  );
};

export default EditPrefillGroupModal;
