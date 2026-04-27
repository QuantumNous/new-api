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
import { Activity, Edit, Inbox, Plus, Save, Trash2 } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

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

const SettingsUptimeKuma = ({ options, refresh }) => {
  const { t } = useTranslation();

  const [uptimeGroupsList, setUptimeGroupsList] = useState([]);
  const [showUptimeModal, setShowUptimeModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uptimeForm, setUptimeForm] = useState({
    categoryName: '',
    url: '',
    slug: '',
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
      showSuccess(t('Uptime Kuma配置已更新'));
      refresh?.();
    } else {
      showError(message);
    }
  };

  const submitUptimeGroups = async () => {
    try {
      setLoading(true);
      const groupsJson = JSON.stringify(uptimeGroupsList);
      await updateOption('console_setting.uptime_kuma_groups', groupsJson);
      setHasChanges(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Uptime Kuma配置更新失败', error);
      showError(t('Uptime Kuma配置更新失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setUptimeForm({ categoryName: '', url: '', slug: '' });
    setFormErrors({});
    setShowUptimeModal(true);
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setUptimeForm({
      categoryName: group.categoryName,
      url: group.url,
      slug: group.slug,
    });
    setFormErrors({});
    setShowUptimeModal(true);
  };

  const handleSaveGroup = async () => {
    const next = {};
    if (!uptimeForm.categoryName?.trim()) next.categoryName = t('请输入分类名称');
    if (!uptimeForm.url?.trim()) {
      next.url = t('请输入Uptime Kuma地址');
    } else {
      try {
        new URL(uptimeForm.url);
      } catch (e) {
        next.url = t('请输入有效的URL地址');
      }
    }
    if (!uptimeForm.slug?.trim()) {
      next.slug = t('请输入状态页面Slug');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(uptimeForm.slug)) {
      next.slug = t('Slug只能包含字母、数字、下划线和连字符');
    }
    setFormErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setModalLoading(true);
      let newList;
      if (editingGroup) {
        newList = uptimeGroupsList.map((item) =>
          item.id === editingGroup.id ? { ...item, ...uptimeForm } : item,
        );
      } else {
        const newId =
          Math.max(...uptimeGroupsList.map((item) => item.id), 0) + 1;
        newList = [...uptimeGroupsList, { id: newId, ...uptimeForm }];
      }
      setUptimeGroupsList(newList);
      setHasChanges(true);
      setShowUptimeModal(false);
      showSuccess(
        editingGroup
          ? t('分类已更新，请及时点击"保存设置"进行保存')
          : t('分类已添加，请及时点击"保存设置"进行保存'),
      );
    } catch (error) {
      showError(t('操作失败') + ': ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const performDeleteGroup = (group) => {
    if (!group) return;
    const newList = uptimeGroupsList.filter((item) => item.id !== group.id);
    setUptimeGroupsList(newList);
    setHasChanges(true);
    showSuccess(t('分类已删除，请及时点击"保存设置"进行保存'));
  };

  const parseUptimeGroups = (groupsStr) => {
    if (!groupsStr) {
      setUptimeGroupsList([]);
      return;
    }
    try {
      const parsed = JSON.parse(groupsStr);
      const list = Array.isArray(parsed) ? parsed : [];
      setUptimeGroupsList(
        list.map((item, index) => ({
          ...item,
          id: item.id || index + 1,
        })),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('解析Uptime Kuma配置失败:', error);
      setUptimeGroupsList([]);
    }
  };

  useEffect(() => {
    const groupsStr = options['console_setting.uptime_kuma_groups'];
    if (groupsStr !== undefined) parseUptimeGroups(groupsStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options['console_setting.uptime_kuma_groups']]);

  useEffect(() => {
    const enabledStr = options['console_setting.uptime_kuma_enabled'];
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
        key: 'console_setting.uptime_kuma_enabled',
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
      showError(t('请先选择要删除的分类'));
      return;
    }
    const newList = uptimeGroupsList.filter(
      (item) => !selectedRowKeys.includes(item.id),
    );
    setUptimeGroupsList(newList);
    setSelectedRowKeys([]);
    setHasChanges(true);
    showSuccess(
      t('已删除 {{count}} 个分类，请及时点击"保存设置"进行保存', {
        count: selectedRowKeys.length,
      }),
    );
  };

  const totalPages = Math.max(1, Math.ceil(uptimeGroupsList.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const pagedData = uptimeGroupsList.slice(startIdx, startIdx + pageSize);

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
    isOpen: showUptimeModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowUptimeModal(false);
    },
  });

  return (
    <div className='space-y-4'>
      <div className='flex items-center text-sky-600'>
        <Activity size={16} className='mr-2' />
        <span className='text-sm'>
          {t(
            'Uptime Kuma监控分类管理，可以配置多个监控分类用于服务状态展示（最多20个）',
          )}
        </span>
      </div>

      <div className='h-px bg-[color:var(--app-border)]' />

      <div className='flex w-full flex-col items-center justify-between gap-4 md:flex-row'>
        <div className='order-2 flex w-full gap-2 md:order-1 md:w-auto'>
          <Button
            variant='tertiary'
            startContent={<Plus size={14} />}
            onPress={handleAddGroup}
            className='w-full md:w-auto'
          >
            {t('添加分类')}
          </Button>
          <Button
            variant='danger-soft'
            startContent={<Trash2 size={14} />}
            isDisabled={selectedRowKeys.length === 0}
            onPress={handleBatchDelete}
            className='w-full md:w-auto'
          >
            {t('批量删除')}{' '}
            {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
          </Button>
          <Button
            variant='tertiary'
            startContent={<Save size={14} />}
            onPress={submitUptimeGroups}
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
              <th className='px-3 py-2 text-left font-semibold'>
                {t('分类名称')}
              </th>
              <th className='px-3 py-2 text-left font-semibold'>
                {t('Uptime Kuma地址')}
              </th>
              <th className='px-3 py-2 text-left font-semibold'>
                {t('状态页面Slug')}
              </th>
              <th className='w-40 px-3 py-2 text-right font-semibold'>
                {t('操作')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-[color:var(--app-border)]'>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={5} className='py-12 text-center text-sm text-muted'>
                  <div className='flex flex-col items-center gap-3'>
                    <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                      <Inbox size={28} />
                    </div>
                    <div>{t('暂无监控数据')}</div>
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
                    <td className='px-3 py-2 font-semibold text-foreground'>
                      {record.categoryName}
                    </td>
                    <td className='max-w-[300px] break-all px-3 py-2 font-mono text-primary'>
                      {record.url}
                    </td>
                    <td className='px-3 py-2 font-mono text-muted'>
                      {record.slug}
                    </td>
                    <td className='px-3 py-2 text-right'>
                      <div className='inline-flex items-center gap-1.5'>
                        <Button
                          variant='tertiary'
                          size='sm'
                          startContent={<Edit size={14} />}
                          onPress={() => handleEditGroup(record)}
                        >
                          {t('编辑')}
                        </Button>
                        <Button
                          variant='danger-soft'
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
          <span>{t('共 {{total}} 条', { total: uptimeGroupsList.length })}</span>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            size='sm'
            variant='tertiary'
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
            variant='tertiary'
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
                {editingGroup ? t('编辑分类') : t('添加分类')}
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('分类名称')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={uptimeForm.categoryName}
                    onChange={(event) =>
                      setUptimeForm((prev) => ({
                        ...prev,
                        categoryName: event.target.value,
                      }))
                    }
                    placeholder={t('请输入分类名称，如：OpenAI、Claude等')}
                    maxLength={50}
                    aria-label={t('分类名称')}
                    className={inputClass}
                  />
                  {formErrors.categoryName ? (
                    <div className='text-xs text-red-600'>
                      {formErrors.categoryName}
                    </div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('Uptime Kuma地址')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={uptimeForm.url}
                    onChange={(event) =>
                      setUptimeForm((prev) => ({
                        ...prev,
                        url: event.target.value,
                      }))
                    }
                    placeholder={t(
                      '请输入Uptime Kuma服务地址，如：https://status.example.com',
                    )}
                    maxLength={500}
                    aria-label={t('Uptime Kuma地址')}
                    className={inputClass}
                  />
                  {formErrors.url ? (
                    <div className='text-xs text-red-600'>{formErrors.url}</div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('状态页面Slug')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={uptimeForm.slug}
                    onChange={(event) =>
                      setUptimeForm((prev) => ({
                        ...prev,
                        slug: event.target.value,
                      }))
                    }
                    placeholder={t('请输入状态页面的Slug，如：my-status')}
                    maxLength={100}
                    aria-label={t('状态页面Slug')}
                    className={inputClass}
                  />
                  {formErrors.slug ? (
                    <div className='text-xs text-red-600'>{formErrors.slug}</div>
                  ) : null}
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button
                  variant='tertiary'
                  onPress={() => setShowUptimeModal(false)}
                >
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={handleSaveGroup}
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
          performDeleteGroup(target);
        }}
      >
        {t('确定要删除此分类吗？')}
      </ConfirmDialog>
    </div>
  );
};

export default SettingsUptimeKuma;
