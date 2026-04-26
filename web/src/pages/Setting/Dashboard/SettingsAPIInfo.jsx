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

import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Switch,
  useOverlayState,
} from '@heroui/react';
import { Edit, Inbox, Plus, Save, Settings, Trash2 } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';
const selectClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const COLOR_OPTIONS = [
  'blue',
  'green',
  'cyan',
  'purple',
  'pink',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'light-green',
  'teal',
  'light-blue',
  'indigo',
  'violet',
  'grey',
];

const TONE_TO_HEX = {
  blue: '#3b82f6',
  green: '#22c55e',
  cyan: '#06b6d4',
  purple: '#a855f7',
  pink: '#ec4899',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  'light-green': '#4ade80',
  teal: '#14b8a6',
  'light-blue': '#0ea5e9',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  grey: '#94a3b8',
};

function ColorChip({ color, children }) {
  const hex = TONE_TO_HEX[color] || '#94a3b8';
  return (
    <span
      className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
      style={{
        backgroundColor: `${hex}1A`,
        color: hex,
        maxWidth: 280,
      }}
    >
      <span className='truncate'>{children}</span>
    </span>
  );
}

function ColorDot({ color, size = 18 }) {
  const hex = TONE_TO_HEX[color] || '#94a3b8';
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: hex,
        display: 'inline-block',
      }}
    />
  );
}

function HeaderCheckbox({ checked, indeterminate, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type='checkbox'
      checked={!!checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={ariaLabel}
      className='h-4 w-4 accent-primary'
    />
  );
}

const SettingsAPIInfo = ({ options, refresh }) => {
  const { t } = useTranslation();

  const [apiInfoList, setApiInfoList] = useState([]);
  const [showApiModal, setShowApiModal] = useState(false);
  const [editingApi, setEditingApi] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [apiForm, setApiForm] = useState({
    url: '',
    description: '',
    route: '',
    color: 'blue',
  });
  const [formErrors, setFormErrors] = useState({});

  const [pendingDelete, setPendingDelete] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [panelEnabled, setPanelEnabled] = useState(true);

  const updateOption = async (key, value) => {
    const res = await API.put('/api/option/', { key, value });
    const { success, message } = res.data || {};
    if (success) {
      showSuccess(t('API信息已更新'));
      refresh?.();
    } else {
      showError(message);
    }
  };

  const submitApiInfo = async () => {
    try {
      setLoading(true);
      const apiInfoJson = JSON.stringify(apiInfoList);
      await updateOption('console_setting.api_info', apiInfoJson);
      setHasChanges(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('API信息更新失败', error);
      showError(t('API信息更新失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddApi = () => {
    setEditingApi(null);
    setApiForm({ url: '', description: '', route: '', color: 'blue' });
    setFormErrors({});
    setShowApiModal(true);
  };

  const handleEditApi = (api) => {
    setEditingApi(api);
    setApiForm({
      url: api.url,
      description: api.description,
      route: api.route,
      color: api.color,
    });
    setFormErrors({});
    setShowApiModal(true);
  };

  const performDeleteApi = (api) => {
    if (!api) return;
    const newList = apiInfoList.filter((item) => item.id !== api.id);
    setApiInfoList(newList);
    setHasChanges(true);
    showSuccess(t('API信息已删除，请及时点击"保存设置"进行保存'));
  };

  const handleSaveApi = async () => {
    const next = {};
    if (!apiForm.url?.trim()) next.url = t('请输入API地址');
    if (!apiForm.route?.trim()) next.route = t('请输入线路描述');
    if (!apiForm.description?.trim()) next.description = t('请输入说明');
    setFormErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setModalLoading(true);
      let newList;
      if (editingApi) {
        newList = apiInfoList.map((api) =>
          api.id === editingApi.id ? { ...api, ...apiForm } : api,
        );
      } else {
        const newId = Math.max(...apiInfoList.map((api) => api.id), 0) + 1;
        newList = [...apiInfoList, { id: newId, ...apiForm }];
      }
      setApiInfoList(newList);
      setHasChanges(true);
      setShowApiModal(false);
      showSuccess(
        editingApi
          ? t('API信息已更新，请及时点击"保存设置"进行保存')
          : t('API信息已添加，请及时点击"保存设置"进行保存'),
      );
    } catch (error) {
      showError(t('操作失败') + ': ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const parseApiInfo = (apiInfoStr) => {
    if (!apiInfoStr) {
      setApiInfoList([]);
      return;
    }
    try {
      const parsed = JSON.parse(apiInfoStr);
      setApiInfoList(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('解析API信息失败:', error);
      setApiInfoList([]);
    }
  };

  useEffect(() => {
    const apiInfoStr = options['console_setting.api_info'] ?? options.ApiInfo;
    if (apiInfoStr !== undefined) parseApiInfo(apiInfoStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options['console_setting.api_info'], options.ApiInfo]);

  useEffect(() => {
    const enabledStr = options['console_setting.api_info_enabled'];
    setPanelEnabled(
      enabledStr === undefined
        ? true
        : enabledStr === 'true' || enabledStr === true,
    );
  }, [options]);

  const handleToggleEnabled = async (checked) => {
    const newValue = checked ? 'true' : 'false';
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.api_info_enabled',
        value: newValue,
      });
      if (res.data?.success) {
        setPanelEnabled(checked);
        showSuccess(t('设置已保存'));
        refresh?.();
      } else {
        showError(res.data?.message);
      }
    } catch (err) {
      showError(err.message);
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      showError(t('请先选择要删除的API信息'));
      return;
    }
    const newList = apiInfoList.filter(
      (api) => !selectedRowKeys.includes(api.id),
    );
    setApiInfoList(newList);
    setSelectedRowKeys([]);
    setHasChanges(true);
    showSuccess(
      t('已删除 {{count}} 个API信息，请及时点击"保存设置"进行保存', {
        count: selectedRowKeys.length,
      }),
    );
  };

  const totalPages = Math.max(1, Math.ceil(apiInfoList.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const pagedData = apiInfoList.slice(startIdx, startIdx + pageSize);

  const visiblePageKeys = pagedData.map((row) => row.id);
  const allPageSelected =
    visiblePageKeys.length > 0 &&
    visiblePageKeys.every((key) => selectedRowKeys.includes(key));
  const somePageSelected =
    !allPageSelected &&
    visiblePageKeys.some((key) => selectedRowKeys.includes(key));

  const togglePageSelection = (checked) => {
    const set = new Set(selectedRowKeys);
    if (checked) visiblePageKeys.forEach((key) => set.add(key));
    else visiblePageKeys.forEach((key) => set.delete(key));
    setSelectedRowKeys(Array.from(set));
  };
  const toggleRowSelection = (key, checked) => {
    const set = new Set(selectedRowKeys);
    if (checked) set.add(key);
    else set.delete(key);
    setSelectedRowKeys(Array.from(set));
  };

  const modalState = useOverlayState({
    isOpen: showApiModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowApiModal(false);
    },
  });

  return (
    <div className='space-y-4'>
      <div className='flex items-center text-sky-600'>
        <Settings size={16} className='mr-2' />
        <span className='text-sm'>
          {t(
            'API信息管理，可以配置多个API地址用于状态展示和负载均衡（最多50个）',
          )}
        </span>
      </div>

      <div className='h-px bg-[color:var(--app-border)]' />

      <div className='flex w-full flex-col items-center justify-between gap-4 md:flex-row'>
        <div className='order-2 flex w-full gap-2 md:order-1 md:w-auto'>
          <Button
            color='primary'
            variant='flat'
            startContent={<Plus size={14} />}
            onPress={handleAddApi}
            className='w-full md:w-auto'
          >
            {t('添加API')}
          </Button>
          <Button
            color='danger'
            variant='flat'
            startContent={<Trash2 size={14} />}
            isDisabled={selectedRowKeys.length === 0}
            onPress={handleBatchDelete}
            className='w-full md:w-auto'
          >
            {t('批量删除')}{' '}
            {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
          </Button>
          <Button
            variant='flat'
            startContent={<Save size={14} />}
            onPress={submitApiInfo}
            isPending={loading}
            isDisabled={!hasChanges}
            className='w-full md:w-auto'
          >
            {t('保存设置')}
          </Button>
        </div>

        <label className='order-1 inline-flex items-center gap-2 md:order-2'>
          <Switch
            isSelected={!!panelEnabled}
            onChange={handleToggleEnabled}
            size='sm'
            aria-label='enabled'
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
          <span className='text-sm text-foreground'>
            {panelEnabled ? t('已启用') : t('已禁用')}
          </span>
        </label>
      </div>

      <div className='overflow-x-auto rounded-xl border border-[color:var(--app-border)]'>
        <table className='w-full text-sm'>
          <thead className='bg-[color:var(--app-background)] text-xs uppercase text-muted'>
            <tr>
              <th className='w-10 px-3 py-2 text-left font-semibold'>
                <HeaderCheckbox
                  checked={allPageSelected}
                  indeterminate={somePageSelected}
                  onChange={togglePageSelection}
                  ariaLabel={t('选择当前页')}
                />
              </th>
              <th className='w-16 px-3 py-2 text-left font-semibold'>ID</th>
              <th className='px-3 py-2 text-left font-semibold'>
                {t('API地址')}
              </th>
              <th className='px-3 py-2 text-left font-semibold'>
                {t('线路描述')}
              </th>
              <th className='px-3 py-2 text-left font-semibold'>{t('说明')}</th>
              <th className='w-16 px-3 py-2 text-left font-semibold'>
                {t('颜色')}
              </th>
              <th className='w-40 px-3 py-2 text-right font-semibold'>
                {t('操作')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-[color:var(--app-border)]'>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={7} className='py-12 text-center text-sm text-muted'>
                  <div className='flex flex-col items-center gap-3'>
                    <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                      <Inbox size={28} />
                    </div>
                    <div>{t('暂无API信息')}</div>
                  </div>
                </td>
              </tr>
            ) : (
              pagedData.map((record) => {
                const checked = selectedRowKeys.includes(record.id);
                return (
                  <tr key={record.id}>
                    <td className='px-3 py-2'>
                      <input
                        type='checkbox'
                        checked={checked}
                        onChange={(event) =>
                          toggleRowSelection(record.id, event.target.checked)
                        }
                        className='h-4 w-4 accent-primary'
                      />
                    </td>
                    <td className='px-3 py-2 text-muted'>{record.id}</td>
                    <td className='px-3 py-2'>
                      <ColorChip color={record.color}>{record.url}</ColorChip>
                    </td>
                    <td className='px-3 py-2'>
                      <span className='inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-background px-2 py-0.5 text-xs text-foreground'>
                        {record.route}
                      </span>
                    </td>
                    <td className='max-w-[260px] truncate px-3 py-2 text-foreground'>
                      <span className='inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-background px-2 py-0.5 text-xs text-foreground'>
                        {record.description || '-'}
                      </span>
                    </td>
                    <td className='px-3 py-2'>
                      <ColorDot color={record.color} />
                    </td>
                    <td className='px-3 py-2 text-right'>
                      <div className='inline-flex items-center gap-1.5'>
                        <Button
                          variant='light'
                          size='sm'
                          startContent={<Edit size={14} />}
                          onPress={() => handleEditApi(record)}
                        >
                          {t('编辑')}
                        </Button>
                        <Button
                          color='danger'
                          variant='flat'
                          size='sm'
                          startContent={<Trash2 size={14} />}
                          onPress={() => setPendingDelete(record)}
                        >
                          {t('删除')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted'>
        <div className='flex items-center gap-2'>
          <span>{t('每页')}</span>
          <select
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setCurrentPage(1);
            }}
            aria-label={t('每页数量')}
            className='h-7 rounded-md border border-[color:var(--app-border)] bg-background px-2 text-xs outline-none focus:border-primary'
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>{t('共 {{total}} 条', { total: apiInfoList.length })}</span>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            size='sm'
            variant='light'
            isDisabled={currentPage <= 1}
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            {t('上一页')}
          </Button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <Button
            size='sm'
            variant='light'
            isDisabled={currentPage >= totalPages}
            onPress={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
          >
            {t('下一页')}
          </Button>
        </div>
      </div>

      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='md' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                {editingApi ? t('编辑API') : t('添加API')}
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('API地址')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={apiForm.url}
                    onChange={(event) =>
                      setApiForm((prev) => ({
                        ...prev,
                        url: event.target.value,
                      }))
                    }
                    placeholder='https://api.example.com'
                    aria-label={t('API地址')}
                    className={inputClass}
                  />
                  {formErrors.url ? (
                    <div className='text-xs text-red-600'>{formErrors.url}</div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('线路描述')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={apiForm.route}
                    onChange={(event) =>
                      setApiForm((prev) => ({
                        ...prev,
                        route: event.target.value,
                      }))
                    }
                    placeholder={t('如：香港线路')}
                    aria-label={t('线路描述')}
                    className={inputClass}
                  />
                  {formErrors.route ? (
                    <div className='text-xs text-red-600'>
                      {formErrors.route}
                    </div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('说明')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={apiForm.description}
                    onChange={(event) =>
                      setApiForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder={t('如：大带宽批量分析图片推荐')}
                    aria-label={t('说明')}
                    className={inputClass}
                  />
                  {formErrors.description ? (
                    <div className='text-xs text-red-600'>
                      {formErrors.description}
                    </div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('标识颜色')}
                  </div>
                  <div className='flex items-center gap-2'>
                    <ColorDot color={apiForm.color} size={20} />
                    <select
                      value={apiForm.color}
                      onChange={(event) =>
                        setApiForm((prev) => ({
                          ...prev,
                          color: event.target.value,
                        }))
                      }
                      aria-label={t('标识颜色')}
                      className={selectClass}
                    >
                      {COLOR_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button variant='light' onPress={() => setShowApiModal(false)}>
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={handleSaveApi}
                  isPending={modalLoading}
                >
                  {t('保存')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      <ConfirmDialog
        visible={!!pendingDelete}
        title={t('确认删除')}
        cancelText={t('取消')}
        confirmText={t('确认删除')}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          performDeleteApi(target);
        }}
      >
        {t('确定要删除此API信息吗？')}
      </ConfirmDialog>
    </div>
  );
};

export default SettingsAPIInfo;
