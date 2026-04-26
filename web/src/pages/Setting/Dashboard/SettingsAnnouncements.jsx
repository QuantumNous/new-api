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
  Tooltip,
  useOverlayState,
} from '@heroui/react';
import {
  Bell,
  Edit,
  Inbox,
  Maximize2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  getRelativeTime,
  formatDateTimeString,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';
const selectClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';
const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

const TONE_CHIP = {
  grey: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  orange:
    'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

function TypeChip({ tone, children }) {
  const cls = TONE_CHIP[tone] || TONE_CHIP.grey;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
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

function toLocalDateTimeInputValue(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const SettingsAnnouncements = ({ options, refresh }) => {
  const { t } = useTranslation();

  const [announcementsList, setAnnouncementsList] = useState([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    content: '',
    publishDate: new Date(),
    type: 'default',
    extra: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const [pendingDelete, setPendingDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [panelEnabled, setPanelEnabled] = useState(true);

  const typeOptions = [
    { value: 'default', label: t('默认') },
    { value: 'ongoing', label: t('进行中') },
    { value: 'success', label: t('成功') },
    { value: 'warning', label: t('警告') },
    { value: 'error', label: t('错误') },
  ];

  const getTypeColor = (type) => {
    const colorMap = {
      default: 'grey',
      ongoing: 'blue',
      success: 'green',
      warning: 'orange',
      error: 'red',
    };
    return colorMap[type] || 'grey';
  };

  const updateOption = async (key, value) => {
    const res = await API.put('/api/option/', { key, value });
    const { success, message } = res.data || {};
    if (success) {
      showSuccess(t('系统公告已更新'));
      refresh?.();
    } else {
      showError(message);
    }
  };

  const submitAnnouncements = async () => {
    try {
      setLoading(true);
      const announcementsJson = JSON.stringify(announcementsList);
      await updateOption('console_setting.announcements', announcementsJson);
      setHasChanges(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('系统公告更新失败', error);
      showError(t('系统公告更新失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({
      content: '',
      publishDate: new Date(),
      type: 'default',
      extra: '',
    });
    setFormErrors({});
    setShowAnnouncementModal(true);
  };

  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      content: announcement.content,
      publishDate: announcement.publishDate
        ? new Date(announcement.publishDate)
        : new Date(),
      type: announcement.type || 'default',
      extra: announcement.extra || '',
    });
    setFormErrors({});
    setShowAnnouncementModal(true);
  };

  const performDeleteAnnouncement = (announcement) => {
    if (!announcement) return;
    const newList = announcementsList.filter(
      (item) => item.id !== announcement.id,
    );
    setAnnouncementsList(newList);
    setHasChanges(true);
    showSuccess(t('公告已删除，请及时点击"保存设置"进行保存'));
  };

  const handleSaveAnnouncement = async () => {
    const next = {};
    if (!announcementForm.content?.trim())
      next.content = t('请输入公告内容');
    if (!announcementForm.publishDate) next.publishDate = t('请选择发布日期');
    setFormErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setModalLoading(true);
      const formData = {
        ...announcementForm,
        publishDate: announcementForm.publishDate.toISOString(),
      };
      let newList;
      if (editingAnnouncement) {
        newList = announcementsList.map((item) =>
          item.id === editingAnnouncement.id ? { ...item, ...formData } : item,
        );
      } else {
        const newId =
          Math.max(...announcementsList.map((item) => item.id), 0) + 1;
        newList = [...announcementsList, { id: newId, ...formData }];
      }
      setAnnouncementsList(newList);
      setHasChanges(true);
      setShowAnnouncementModal(false);
      showSuccess(
        editingAnnouncement
          ? t('公告已更新，请及时点击"保存设置"进行保存')
          : t('公告已添加，请及时点击"保存设置"进行保存'),
      );
    } catch (error) {
      showError(t('操作失败') + ': ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const parseAnnouncements = (announcementsStr) => {
    if (!announcementsStr) {
      setAnnouncementsList([]);
      return;
    }
    try {
      const parsed = JSON.parse(announcementsStr);
      const list = Array.isArray(parsed) ? parsed : [];
      setAnnouncementsList(
        list.map((item, index) => ({
          ...item,
          id: item.id || index + 1,
        })),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('解析系统公告失败:', error);
      setAnnouncementsList([]);
    }
  };

  useEffect(() => {
    const annStr =
      options['console_setting.announcements'] ?? options.Announcements;
    if (annStr !== undefined) parseAnnouncements(annStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options['console_setting.announcements'], options.Announcements]);

  useEffect(() => {
    const enabledStr = options['console_setting.announcements_enabled'];
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
        key: 'console_setting.announcements_enabled',
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
      showError(t('请先选择要删除的系统公告'));
      return;
    }
    const newList = announcementsList.filter(
      (item) => !selectedRowKeys.includes(item.id),
    );
    setAnnouncementsList(newList);
    setSelectedRowKeys([]);
    setHasChanges(true);
    showSuccess(
      t('已删除 {{count}} 个系统公告，请及时点击"保存设置"进行保存', {
        count: selectedRowKeys.length,
      }),
    );
  };

  const sortedList = [...announcementsList].sort((a, b) => {
    const dateA = new Date(a.publishDate).getTime();
    const dateB = new Date(b.publishDate).getTime();
    return dateB - dateA;
  });
  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const pagedData = sortedList.slice(startIdx, startIdx + pageSize);

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

  const editModalState = useOverlayState({
    isOpen: showAnnouncementModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowAnnouncementModal(false);
    },
  });
  const contentModalState = useOverlayState({
    isOpen: showContentModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowContentModal(false);
    },
  });

  return (
    <div className='space-y-4'>
      <div className='flex items-center text-sky-600'>
        <Bell size={16} className='mr-2' />
        <span className='text-sm'>
          {t(
            '系统公告管理，可以发布系统通知和重要消息（最多100个，前端显示最新20条）',
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
            onPress={handleAddAnnouncement}
            className='w-full md:w-auto'
          >
            {t('添加公告')}
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
            onPress={submitAnnouncements}
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
                {t('内容')}
              </th>
              <th className='w-44 px-3 py-2 text-left font-semibold'>
                {t('发布时间')}
              </th>
              <th className='w-24 px-3 py-2 text-left font-semibold'>
                {t('类型')}
              </th>
              <th className='px-3 py-2 text-left font-semibold'>
                {t('说明')}
              </th>
              <th className='w-40 px-3 py-2 text-right font-semibold'>
                {t('操作')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-[color:var(--app-border)]'>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={6} className='py-12 text-center text-sm text-muted'>
                  <div className='flex flex-col items-center gap-3'>
                    <div className='flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'>
                      <Inbox size={28} />
                    </div>
                    <div>{t('暂无系统公告')}</div>
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
                    <td className='max-w-[300px] truncate px-3 py-2 text-foreground'>
                      <Tooltip content={record.content} placement='top'>
                        <span>{record.content}</span>
                      </Tooltip>
                    </td>
                    <td className='px-3 py-2 text-foreground'>
                      <div className='font-semibold'>
                        {getRelativeTime(record.publishDate)}
                      </div>
                      <div className='text-xs text-muted'>
                        {record.publishDate
                          ? formatDateTimeString(new Date(record.publishDate))
                          : '-'}
                      </div>
                    </td>
                    <td className='px-3 py-2'>
                      <TypeChip tone={getTypeColor(record.type)}>
                        {typeOptions.find((opt) => opt.value === record.type)
                          ?.label || record.type}
                      </TypeChip>
                    </td>
                    <td className='max-w-[200px] truncate px-3 py-2 text-muted'>
                      <Tooltip content={record.extra || '-'} placement='top'>
                        <span>{record.extra || '-'}</span>
                      </Tooltip>
                    </td>
                    <td className='px-3 py-2 text-right'>
                      <div className='inline-flex items-center gap-1.5'>
                        <Button
                          variant='light'
                          size='sm'
                          startContent={<Edit size={14} />}
                          onPress={() => handleEditAnnouncement(record)}
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
          <span>{t('共 {{total}} 条', { total: announcementsList.length })}</span>
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

      <Modal state={editModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='md' placement='center'>
            <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
              <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
                {editingAnnouncement ? t('编辑公告') : t('添加公告')}
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <div className='text-sm font-medium text-foreground'>
                      {t('公告内容')}
                      <span className='ml-1 text-red-500'>*</span>
                    </div>
                    <Button
                      variant='light'
                      size='sm'
                      startContent={<Maximize2 size={14} />}
                      onPress={() => setShowContentModal(true)}
                    >
                      {t('放大编辑')}
                    </Button>
                  </div>
                  <textarea
                    value={announcementForm.content}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        content: event.target.value,
                      }))
                    }
                    placeholder={t('请输入公告内容（支持 Markdown/HTML）')}
                    rows={3}
                    maxLength={500}
                    aria-label={t('公告内容')}
                    className={textareaClass}
                  />
                  {formErrors.content ? (
                    <div className='text-xs text-red-600'>
                      {formErrors.content}
                    </div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('发布日期')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <input
                    type='datetime-local'
                    value={toLocalDateTimeInputValue(announcementForm.publishDate)}
                    onChange={(event) => {
                      const v = event.target.value;
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        publishDate: v ? new Date(v) : null,
                      }));
                    }}
                    aria-label={t('发布日期')}
                    className={inputClass}
                  />
                  {formErrors.publishDate ? (
                    <div className='text-xs text-red-600'>
                      {formErrors.publishDate}
                    </div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('公告类型')}
                  </div>
                  <select
                    value={announcementForm.type}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        type: event.target.value,
                      }))
                    }
                    aria-label={t('公告类型')}
                    className={selectClass}
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('说明信息')}
                  </div>
                  <Input
                    type='text'
                    value={announcementForm.extra}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        extra: event.target.value,
                      }))
                    }
                    placeholder={t('可选，公告的补充说明')}
                    aria-label={t('说明信息')}
                    className={inputClass}
                  />
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
                <Button
                  variant='light'
                  onPress={() => setShowAnnouncementModal(false)}
                >
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={handleSaveAnnouncement}
                  isPending={modalLoading}
                >
                  {t('保存')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      <Modal state={contentModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='lg' placement='center'>
            <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
              <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
                {t('编辑公告内容')}
              </ModalHeader>
              <ModalBody className='px-6 py-5'>
                <textarea
                  value={announcementForm.content}
                  onChange={(event) =>
                    setAnnouncementForm((prev) => ({
                      ...prev,
                      content: event.target.value,
                    }))
                  }
                  placeholder={t('请输入公告内容（支持 Markdown/HTML）')}
                  rows={15}
                  maxLength={500}
                  aria-label={t('公告内容')}
                  className={textareaClass}
                />
              </ModalBody>
              <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
                <Button variant='light' onPress={() => setShowContentModal(false)}>
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={() => setShowContentModal(false)}
                >
                  {t('确定')}
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
          performDeleteAnnouncement(target);
        }}
      >
        {t('确定要删除此公告吗？')}
      </ConfirmDialog>
    </div>
  );
};

export default SettingsAnnouncements;
