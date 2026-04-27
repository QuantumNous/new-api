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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import {
  ChevronDown,
  Edit3,
  Info,
  Plus,
  Save,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import ClickMenu from '../../../components/common/ui/ClickMenu';

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary';

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <div className='mt-1 text-xs text-danger'>{children}</div>;
}

function InfoBanner({ children }) {
  return (
    <div className='flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground'>
      <Info size={14} className='mt-0.5 shrink-0 text-primary' />
      <span>{children}</span>
    </div>
  );
}

const BUILTIN_TEMPLATES = [
  {
    name: 'Cherry Studio',
    url: 'cherrystudio://providers/api-keys?v=1&data={cherryConfig}',
  },
  { name: 'AionUI', url: 'aionui://provider/add?v=1&data={aionuiConfig}' },
  { name: '流畅阅读', url: 'fluentread' },
  { name: 'CC Switch', url: 'ccswitch' },
  {
    name: 'Lobe Chat',
    url: 'https://chat-preview.lobehub.com/?settings={"keyVaults":{"openai":{"apiKey":"{key}","baseURL":"{address}/v1"}}}',
  },
  {
    name: 'AI as Workspace',
    url: 'https://aiaw.app/set-provider?provider={"type":"openai","settings":{"apiKey":"{key}","baseURL":"{address}/v1","compatibility":"strict"}}',
  },
  { name: 'AMA 问天', url: 'ama://set-api-key?server={address}&key={key}' },
  { name: 'OpenCat', url: 'opencat://team/join?domain={address}&token={key}' },
];

const PAGE_SIZE = 10;

const jsonToConfigs = (jsonString) => {
  try {
    const configs = JSON.parse(jsonString);
    return Array.isArray(configs)
      ? configs.map((config, index) => ({
          id: index,
          name: Object.keys(config)[0] || '',
          url: Object.values(config)[0] || '',
        }))
      : [];
  } catch (error) {
    console.error('JSON parse error:', error);
    return [];
  }
};

const configsToJson = (configs) => {
  const jsonArray = configs.map((config) => ({
    [config.name]: config.url,
  }));
  return JSON.stringify(jsonArray, null, 2);
};

export default function SettingsChats(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({ Chats: '[]' });
  const [inputsRow, setInputsRow] = useState({ Chats: '[]' });
  const [editMode, setEditMode] = useState('visual');
  const [chatConfigs, setChatConfigs] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [jsonError, setJsonError] = useState('');

  // Edit modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [modalForm, setModalForm] = useState({ name: '', url: '' });
  const [modalErrors, setModalErrors] = useState({});

  const modalState = useOverlayState({
    isOpen: modalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleModalCancel();
    },
  });

  const syncConfigsToJson = (configs) => {
    const jsonString = configsToJson(configs);
    setInputs((prev) => ({ ...prev, Chats: jsonString }));
  };

  const addTemplates = (templates) => {
    const existingNames = new Set(chatConfigs.map((c) => c.name));
    const toAdd = templates.filter((tpl) => !existingNames.has(tpl.name));
    if (toAdd.length === 0) {
      showWarning(t('所选模板已存在'));
      return;
    }
    let maxId =
      chatConfigs.length > 0 ? Math.max(...chatConfigs.map((c) => c.id)) : -1;
    const newItems = toAdd.map((tpl) => ({
      id: ++maxId,
      name: tpl.name,
      url: tpl.url,
    }));
    const newConfigs = [...chatConfigs, ...newItems];
    setChatConfigs(newConfigs);
    syncConfigsToJson(newConfigs);
    showSuccess(t('已添加 {{count}} 个模板', { count: toAdd.length }));
  };

  async function onSubmit() {
    if (editMode === 'json' && jsonError) {
      showError(t('请检查输入'));
      return;
    }
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    try {
      const res = await Promise.all(requestQueue);
      if (res.includes(undefined)) {
        if (requestQueue.length > 1) {
          showError(t('部分保存失败，请重试'));
        }
        return;
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        if (key === 'Chats') {
          try {
            const obj = JSON.parse(props.options[key]);
            currentInputs[key] = JSON.stringify(obj, null, 2);
          } catch (error) {
            currentInputs[key] = props.options[key];
          }
        } else {
          currentInputs[key] = props.options[key];
        }
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));

    const configs = jsonToConfigs(currentInputs.Chats || '[]');
    setChatConfigs(configs);
    setJsonError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.options]);

  // Re-sync visual configs whenever the JSON changes (e.g. after a
  // template fill or an edit modal save).
  useEffect(() => {
    if (editMode === 'visual') {
      const configs = jsonToConfigs(inputs.Chats || '[]');
      setChatConfigs(configs);
    }
  }, [inputs.Chats, editMode]);

  const handleAddConfig = () => {
    setEditingConfig({ name: '', url: '' });
    setIsEdit(false);
    setModalForm({ name: '', url: '' });
    setModalErrors({});
    setModalVisible(true);
  };

  const handleEditConfig = (config) => {
    setEditingConfig({ ...config });
    setIsEdit(true);
    setModalForm({ name: config.name || '', url: config.url || '' });
    setModalErrors({});
    setModalVisible(true);
  };

  const handleDeleteConfig = (id) => {
    const newConfigs = chatConfigs.filter((config) => config.id !== id);
    setChatConfigs(newConfigs);
    syncConfigsToJson(newConfigs);
    showSuccess(t('删除成功'));
  };

  const validateModalForm = () => {
    const next = {};
    if (!modalForm.name?.trim()) next.name = t('请输入聊天应用名称');
    if (!modalForm.url?.trim()) next.url = t('请输入URL链接');
    setModalErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleModalOk = () => {
    if (!validateModalForm()) return;
    const values = { name: modalForm.name.trim(), url: modalForm.url.trim() };

    const isDuplicate = chatConfigs.some(
      (config) =>
        config.name === values.name &&
        (!isEdit || config.id !== editingConfig.id),
    );
    if (isDuplicate) {
      showError(t('聊天应用名称已存在，请使用其他名称'));
      return;
    }

    if (isEdit) {
      const newConfigs = chatConfigs.map((config) =>
        config.id === editingConfig.id
          ? { ...editingConfig, ...values }
          : config,
      );
      setChatConfigs(newConfigs);
      syncConfigsToJson(newConfigs);
    } else {
      const maxId =
        chatConfigs.length > 0 ? Math.max(...chatConfigs.map((c) => c.id)) : -1;
      const newConfig = { id: maxId + 1, ...values };
      const newConfigs = [...chatConfigs, newConfig];
      setChatConfigs(newConfigs);
      syncConfigsToJson(newConfigs);
    }

    setModalVisible(false);
    setEditingConfig(null);
    showSuccess(isEdit ? t('编辑成功') : t('添加成功'));
  };

  function handleModalCancel() {
    setModalVisible(false);
    setEditingConfig(null);
  }

  const filteredConfigs = useMemo(() => {
    return chatConfigs.filter(
      (config) =>
        !searchText ||
        config.name.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [chatConfigs, searchText]);

  // Reset to first page whenever the filter changes the page-1 set.
  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredConfigs.length / PAGE_SIZE),
    );
    if (page > pageCount) setPage(pageCount);
  }, [filteredConfigs.length, page]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = filteredConfigs.slice(pageStart, pageStart + PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filteredConfigs.length / PAGE_SIZE));

  const highlightKeywords = (text) => {
    if (!text) return text;

    const parts = text.split(/(\{address\}|\{key\})/g);
    return parts.map((part, index) => {
      if (part === '{address}') {
        return (
          <span key={index} className='font-semibold text-primary'>
            {part}
          </span>
        );
      } else if (part === '{key}') {
        return (
          <span key={index} className='font-semibold text-warning'>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const dropdownItems = useMemo(
    () => [
      ...BUILTIN_TEMPLATES.map((tpl) => ({
        label: tpl.name,
        onClick: () => addTemplates([tpl]),
      })),
      { divider: true },
      {
        label: t('全部填入'),
        onClick: () => addTemplates(BUILTIN_TEMPLATES),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatConfigs],
  );

  return (
    <div className='relative space-y-4'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
          <Spinner color='primary' />
        </div>
      )}

      <div className='space-y-3'>
        <div className='text-base font-semibold text-foreground'>
          {t('聊天设置')}
        </div>
        <InfoBanner>
          {t(
            '链接中的{key}将自动替换为sk-xxxx，{address}将自动替换为系统设置的服务器地址，末尾不带/和/v1',
          )}
        </InfoBanner>

        <div className='border-t border-border' />

        <div className='flex items-center gap-3'>
          <span className='text-sm font-semibold text-foreground'>
            {t('编辑模式')}:
          </span>
          <div className='inline-flex overflow-hidden rounded-xl border border-border'>
            {[
              { value: 'visual', label: t('可视化编辑') },
              { value: 'json', label: t('JSON编辑') },
            ].map((mode) => {
              const active = mode.value === editMode;
              return (
                <button
                  key={mode.value}
                  type='button'
                  onClick={() => setEditMode(mode.value)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-foreground text-background'
                      : 'bg-background text-muted hover:bg-surface-secondary'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {editMode === 'visual' ? (
          <div className='space-y-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <Button color='primary' onPress={handleAddConfig}>
                <Plus size={14} />
                {t('添加聊天配置')}
              </Button>
              <ClickMenu
                placement='bottomLeft'
                items={dropdownItems}
                trigger={
                  <Button variant='tertiary'>
                    <Zap size={14} />
                    {t('填入模板')}
                    <ChevronDown size={14} />
                  </Button>
                }
              />
              <Button variant='primary' onPress={onSubmit}>
                <Save size={14} />
                {t('保存聊天设置')}
              </Button>
              <div className='relative ml-auto w-[250px]'>
                <Search
                  size={14}
                  className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                />
                <input
                  type='text'
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t('搜索聊天应用名称')}
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>

            <div className='overflow-x-auto rounded-xl border border-border'>
              <table className='w-full text-sm'>
                <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
                  <tr>
                    <th className='px-4 py-2 text-left font-medium'>
                      {t('聊天应用名称')}
                    </th>
                    <th className='px-4 py-2 text-left font-medium'>
                      {t('URL链接')}
                    </th>
                    <th className='w-[180px] px-4 py-2 text-left font-medium'>
                      {t('操作')}
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border'>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className='px-4 py-10 text-center text-sm text-muted'
                      >
                        {t('暂无数据')}
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((record) => (
                      <tr
                        key={record.id}
                        className='bg-background hover:bg-surface-secondary/60'
                      >
                        <td className='px-4 py-3 align-top text-foreground'>
                          {record.name || t('未命名')}
                        </td>
                        <td className='px-4 py-3 align-top text-foreground'>
                          <div className='max-w-[420px] break-all'>
                            {highlightKeywords(record.url)}
                          </div>
                        </td>
                        <td className='px-4 py-3 align-top'>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              size='sm'
                              variant='tertiary'
                              onPress={() => handleEditConfig(record)}
                            >
                              <Edit3 size={14} />
                              {t('编辑')}
                            </Button>
                            <Button
                              size='sm'
                              variant='danger-soft'
                              onPress={() => handleDeleteConfig(record.id)}
                            >
                              <Trash2 size={14} />
                              {t('删除')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredConfigs.length > PAGE_SIZE && (
              <div className='flex items-center justify-between text-xs text-muted'>
                <span>
                  {t('共 {{total}} 项，当前显示 {{start}}-{{end}} 项', {
                    total: filteredConfigs.length,
                    start: pageStart + 1,
                    end: Math.min(
                      filteredConfigs.length,
                      pageStart + pageItems.length,
                    ),
                  })}
                </span>
                <div className='flex items-center gap-2'>
                  <Button
                    size='sm'
                    variant='tertiary'
                    isDisabled={page <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t('上一页')}
                  </Button>
                  <span>
                    {page} / {pageCount}
                  </span>
                  <Button
                    size='sm'
                    variant='tertiary'
                    isDisabled={page >= pageCount}
                    onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    {t('下一页')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className='space-y-2'>
            <FieldLabel>{t('聊天配置')}</FieldLabel>
            <textarea
              rows={10}
              value={inputs.Chats || ''}
              onChange={(event) => {
                const value = event.target.value;
                setInputs((prev) => ({ ...prev, Chats: value }));
              }}
              onBlur={(event) => {
                const value = event.target.value;
                if (value && !verifyJSON(value)) {
                  setJsonError(t('不是合法的 JSON 字符串'));
                } else {
                  setJsonError('');
                }
              }}
              placeholder={t('为一个 JSON 文本')}
              className={textareaClass}
            />
            <FieldError>{jsonError}</FieldError>
          </div>
        )}
      </div>

      {editMode === 'json' && (
        <div>
          <Button color='primary' onPress={onSubmit}>
            <Save size={14} />
            {t('保存聊天设置')}
          </Button>
        </div>
      )}

      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='lg' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <span>{isEdit ? t('编辑聊天配置') : t('添加聊天配置')}</span>
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('聊天应用名称')}</FieldLabel>
                  <input
                    type='text'
                    value={modalForm.name}
                    onChange={(event) => {
                      setModalForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }));
                      if (modalErrors.name) {
                        setModalErrors((prev) => ({
                          ...prev,
                          name: undefined,
                        }));
                      }
                    }}
                    placeholder={t('请输入聊天应用名称')}
                    className={inputClass}
                  />
                  <FieldError>{modalErrors.name}</FieldError>
                </div>

                <div className='space-y-2'>
                  <FieldLabel required>{t('URL链接')}</FieldLabel>
                  <input
                    type='text'
                    value={modalForm.url}
                    onChange={(event) => {
                      setModalForm((prev) => ({
                        ...prev,
                        url: event.target.value,
                      }));
                      if (modalErrors.url) {
                        setModalErrors((prev) => ({
                          ...prev,
                          url: undefined,
                        }));
                      }
                    }}
                    placeholder={t('请输入完整的URL链接')}
                    className={inputClass}
                  />
                  <FieldError>{modalErrors.url}</FieldError>
                </div>

                <InfoBanner>
                  {t(
                    '提示：链接中的{key}将被替换为API密钥，{address}将被替换为服务器地址',
                  )}
                </InfoBanner>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button variant='tertiary' onPress={handleModalCancel}>
                  {t('取消')}
                </Button>
                <Button color='primary' onPress={handleModalOk}>
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
