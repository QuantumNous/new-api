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
  Edit,
  HelpCircle,
  Inbox,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';
const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

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

const SettingsFAQ = ({ options, refresh }) => {
  const { t } = useTranslation();

  const [faqList, setFaqList] = useState([]);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '' });
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
      showSuccess(t('常见问答已更新'));
      refresh?.();
    } else {
      showError(message);
    }
  };

  const submitFAQ = async () => {
    try {
      setLoading(true);
      const faqJson = JSON.stringify(faqList);
      await updateOption('console_setting.faq', faqJson);
      setHasChanges(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('常见问答更新失败', error);
      showError(t('常见问答更新失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaq = () => {
    setEditingFaq(null);
    setFaqForm({ question: '', answer: '' });
    setFormErrors({});
    setShowFaqModal(true);
  };

  const handleEditFaq = (faq) => {
    setEditingFaq(faq);
    setFaqForm({ question: faq.question, answer: faq.answer });
    setFormErrors({});
    setShowFaqModal(true);
  };

  const handleSaveFaq = async () => {
    const next = {};
    if (!faqForm.question?.trim()) next.question = t('请输入问题标题');
    if (!faqForm.answer?.trim()) next.answer = t('请输入回答内容');
    setFormErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setModalLoading(true);
      let newList;
      if (editingFaq) {
        newList = faqList.map((item) =>
          item.id === editingFaq.id ? { ...item, ...faqForm } : item,
        );
      } else {
        const newId = Math.max(...faqList.map((item) => item.id), 0) + 1;
        newList = [...faqList, { id: newId, ...faqForm }];
      }
      setFaqList(newList);
      setHasChanges(true);
      setShowFaqModal(false);
      showSuccess(
        editingFaq
          ? t('问答已更新，请及时点击"保存设置"进行保存')
          : t('问答已添加，请及时点击"保存设置"进行保存'),
      );
    } catch (error) {
      showError(t('操作失败') + ': ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const performDeleteFaq = (faq) => {
    if (!faq) return;
    const newList = faqList.filter((item) => item.id !== faq.id);
    setFaqList(newList);
    setHasChanges(true);
    showSuccess(t('问答已删除，请及时点击"保存设置"进行保存'));
  };

  const parseFAQ = (faqStr) => {
    if (!faqStr) {
      setFaqList([]);
      return;
    }
    try {
      const parsed = JSON.parse(faqStr);
      const list = Array.isArray(parsed) ? parsed : [];
      setFaqList(
        list.map((item, index) => ({
          ...item,
          id: item.id || index + 1,
        })),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('解析常见问答失败:', error);
      setFaqList([]);
    }
  };

  useEffect(() => {
    if (options['console_setting.faq'] !== undefined) {
      parseFAQ(options['console_setting.faq']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options['console_setting.faq']]);

  useEffect(() => {
    const enabledStr = options['console_setting.faq_enabled'];
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
        key: 'console_setting.faq_enabled',
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
      showError(t('请先选择要删除的常见问答'));
      return;
    }
    const newList = faqList.filter(
      (item) => !selectedRowKeys.includes(item.id),
    );
    setFaqList(newList);
    setSelectedRowKeys([]);
    setHasChanges(true);
    showSuccess(
      t('已删除 {{count}} 个常见问答，请及时点击"保存设置"进行保存', {
        count: selectedRowKeys.length,
      }),
    );
  };

  const totalPages = Math.max(1, Math.ceil(faqList.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const pagedData = faqList.slice(startIdx, startIdx + pageSize);

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
    isOpen: showFaqModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowFaqModal(false);
    },
  });

  return (
    <div className='space-y-4'>
      <div className='flex items-center text-sky-600'>
        <HelpCircle size={16} className='mr-2' />
        <span className='text-sm'>
          {t(
            '常见问答管理，为用户提供常见问题的答案（最多50个，前端显示最新20条）',
          )}
        </span>
      </div>

      <div className='h-px bg-[color:var(--app-border)]' />

      <div className='flex w-full flex-col items-center justify-between gap-4 md:flex-row'>
        <div className='order-2 flex w-full gap-2 md:order-1 md:w-auto'>
          <Button
            variant='tertiary'
            startContent={<Plus size={14} />}
            onPress={handleAddFaq}
            className='w-full md:w-auto'
          >
            {t('添加问答')}
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
            onPress={submitFAQ}
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
                {t('问题标题')}
              </th>
              <th className='px-3 py-2 text-left font-semibold'>
                {t('回答内容')}
              </th>
              <th className='w-40 px-3 py-2 text-right font-semibold'>
                {t('操作')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-[color:var(--app-border)]'>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={4} className='py-12 text-center text-sm text-muted'>
                  <div className='flex flex-col items-center gap-3'>
                    <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                      <Inbox size={28} />
                    </div>
                    <div>{t('暂无常见问答')}</div>
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
                    <td className='max-w-[300px] truncate px-3 py-2 font-semibold text-foreground'>
                      <Tooltip content={record.question} placement='top'>
                        <span>{record.question}</span>
                      </Tooltip>
                    </td>
                    <td className='max-w-[400px] truncate px-3 py-2 text-muted'>
                      <Tooltip content={record.answer} placement='top'>
                        <span>{record.answer}</span>
                      </Tooltip>
                    </td>
                    <td className='px-3 py-2 text-right'>
                      <div className='inline-flex items-center gap-1.5'>
                        <Button
                          variant='tertiary'
                          size='sm'
                          startContent={<Edit size={14} />}
                          onPress={() => handleEditFaq(record)}
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
          <span>{t('共 {{total}} 条', { total: faqList.length })}</span>
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
          <ModalContainer size='lg' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                {editingFaq ? t('编辑问答') : t('添加问答')}
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('问题标题')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={faqForm.question}
                    onChange={(event) =>
                      setFaqForm((prev) => ({
                        ...prev,
                        question: event.target.value,
                      }))
                    }
                    placeholder={t('请输入问题标题')}
                    maxLength={200}
                    aria-label={t('问题标题')}
                    className={inputClass}
                  />
                  {formErrors.question ? (
                    <div className='text-xs text-red-600'>
                      {formErrors.question}
                    </div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('回答内容')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <textarea
                    value={faqForm.answer}
                    onChange={(event) =>
                      setFaqForm((prev) => ({
                        ...prev,
                        answer: event.target.value,
                      }))
                    }
                    placeholder={t('请输入回答内容（支持 Markdown/HTML）')}
                    rows={6}
                    maxLength={1000}
                    aria-label={t('回答内容')}
                    className={textareaClass}
                  />
                  {formErrors.answer ? (
                    <div className='text-xs text-red-600'>
                      {formErrors.answer}
                    </div>
                  ) : null}
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button variant='tertiary' onPress={() => setShowFaqModal(false)}>
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={handleSaveFaq}
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
          performDeleteFaq(target);
        }}
      >
        {t('确定要删除此问答吗？')}
      </ConfirmDialog>
    </div>
  );
};

export default SettingsFAQ;
