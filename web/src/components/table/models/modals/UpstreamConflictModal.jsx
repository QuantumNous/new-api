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

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
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
  useOverlayState,
} from '@heroui/react';
import { Inbox, MousePointerClick, Search } from 'lucide-react';
import HoverPanel from '@/components/common/ui/HoverPanel';
import { MODEL_TABLE_PAGE_SIZE } from '../../../../constants';

const FIELD_LABELS = {
  description: '描述',
  icon: '图标',
  tags: '标签',
  vendor: '供应商',
  name_rule: '命名规则',
  status: '状态',
};
const FIELD_KEYS = Object.keys(FIELD_LABELS);

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

function Pager({ current, pageSize, total, onChange, t }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className='mt-2 flex items-center justify-end gap-2 text-sm text-muted'>
      <span>{t('共 {{total}} 条', { total })}</span>
      <Button
        size='sm'
        variant='tertiary'
        isDisabled={current <= 1}
        onPress={() => onChange(current - 1)}
      >
        {t('上一页')}
      </Button>
      <span>
        {current} / {totalPages}
      </span>
      <Button
        size='sm'
        variant='tertiary'
        isDisabled={current >= totalPages}
        onPress={() => onChange(current + 1)}
      >
        {t('下一页')}
      </Button>
    </div>
  );
}

const UpstreamConflictModal = ({
  visible,
  onClose,
  conflicts = [],
  onSubmit,
  t,
  loading = false,
}) => {
  const [selections, setSelections] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');

  const formatValue = (v) => {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'string') return v || '-';
    try {
      return JSON.stringify(v, null, 2);
    } catch (_) {
      return String(v);
    }
  };

  useEffect(() => {
    if (visible) {
      const init = {};
      conflicts.forEach((item) => {
        init[item.model_name] = new Set();
      });
      setSelections(init);
      setCurrentPage(1);
      setSearchKeyword('');
    } else {
      setSelections({});
    }
  }, [visible, conflicts]);

  const toggleField = useCallback((modelName, field, checked) => {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[modelName] || []);
      if (checked) set.add(field);
      else set.delete(field);
      next[modelName] = set;
      return next;
    });
  }, []);

  const dataSource = useMemo(
    () =>
      (conflicts || []).map((c) => ({
        key: c.model_name,
        model_name: c.model_name,
        fields: c.fields || [],
      })),
    [conflicts],
  );

  const filteredDataSource = useMemo(() => {
    const kw = (searchKeyword || '').toLowerCase();
    if (!kw) return dataSource;
    return dataSource.filter((item) =>
      (item.model_name || '').toLowerCase().includes(kw),
    );
  }, [dataSource, searchKeyword]);

  const getPresentRowsForField = useCallback(
    (fieldKey) =>
      (filteredDataSource || []).filter((row) =>
        (row.fields || []).some((f) => f.field === fieldKey),
      ),
    [filteredDataSource],
  );

  const getHeaderState = useCallback(
    (fieldKey) => {
      const presentRows = getPresentRowsForField(fieldKey);
      const selectedCount = presentRows.filter((row) =>
        selections[row.model_name]?.has(fieldKey),
      ).length;
      const allCount = presentRows.length;
      return {
        headerChecked: allCount > 0 && selectedCount === allCount,
        headerIndeterminate: selectedCount > 0 && selectedCount < allCount,
        hasAny: allCount > 0,
      };
    },
    [getPresentRowsForField, selections],
  );

  const applyHeaderChange = useCallback(
    (fieldKey, checked) => {
      setSelections((prev) => {
        const next = { ...prev };
        getPresentRowsForField(fieldKey).forEach((row) => {
          const set = new Set(next[row.model_name] || []);
          if (checked) set.add(fieldKey);
          else set.delete(fieldKey);
          next[row.model_name] = set;
        });
        return next;
      });
    },
    [getPresentRowsForField],
  );

  const visibleFields = FIELD_KEYS.filter((key) => getHeaderState(key).hasAny);

  const pagedDataSource = useMemo(() => {
    const start = (currentPage - 1) * MODEL_TABLE_PAGE_SIZE;
    const end = start + MODEL_TABLE_PAGE_SIZE;
    return filteredDataSource.slice(start, end);
  }, [filteredDataSource, currentPage]);

  const handleOk = async () => {
    const payload = Object.entries(selections)
      .map(([modelName, set]) => ({
        model_name: modelName,
        fields: Array.from(set || []),
      }))
      .filter((x) => x.fields.length > 0);
    const ok = await onSubmit?.(payload);
    if (ok) onClose?.();
  };

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='xl' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {t('选择要覆盖的冲突项')}
            </ModalHeader>
            <ModalBody className='space-y-3 px-6 py-5'>
              {dataSource.length === 0 ? (
                <div className='flex flex-col items-center gap-3 py-10 text-center text-sm text-muted'>
                  <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                    <Inbox size={28} />
                  </div>
                  <div>{t('无冲突项')}</div>
                </div>
              ) : (
                <>
                  <div className='text-xs text-muted'>
                    {t('仅会覆盖你勾选的字段，未勾选的字段保持本地不变。')}
                  </div>

                  <div className='relative'>
                    <Search
                      size={14}
                      className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                    />
                    <Input
                      type='text'
                      placeholder={t('搜索模型...')}
                      value={searchKeyword}
                      onChange={(event) => {
                        setSearchKeyword(event.target.value);
                        setCurrentPage(1);
                      }}
                      aria-label={t('搜索模型')}
                      className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary'
                    />
                  </div>

                  {filteredDataSource.length === 0 ? (
                    <div className='flex flex-col items-center gap-3 py-10 text-center text-sm text-muted'>
                      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                        <Inbox size={28} />
                      </div>
                      <div>{t('未找到匹配的模型')}</div>
                    </div>
                  ) : (
                    <div className='overflow-x-auto rounded-xl border border-[color:var(--app-border)]'>
                      <table className='w-full text-sm'>
                        <thead className='bg-[color:var(--app-background)] text-xs uppercase text-muted'>
                          <tr>
                            <th className='sticky left-0 z-10 bg-[color:var(--app-background)] px-3 py-2 text-left font-semibold'>
                              {t('模型')}
                            </th>
                            {visibleFields.map((fieldKey) => {
                              const { headerChecked, headerIndeterminate } =
                                getHeaderState(fieldKey);
                              return (
                                <th
                                  key={fieldKey}
                                  className='whitespace-nowrap px-3 py-2 text-left font-semibold'
                                >
                                  <span className='inline-flex items-center gap-2'>
                                    <HeaderCheckbox
                                      checked={headerChecked}
                                      indeterminate={headerIndeterminate}
                                      onChange={(checked) =>
                                        applyHeaderChange(fieldKey, checked)
                                      }
                                      ariaLabel={t(FIELD_LABELS[fieldKey])}
                                    />
                                    <span>{t(FIELD_LABELS[fieldKey])}</span>
                                  </span>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-[color:var(--app-border)]'>
                          {pagedDataSource.map((record) => (
                            <tr key={record.key}>
                              <td className='sticky left-0 z-10 bg-background px-3 py-2 font-semibold text-foreground'>
                                {record.model_name}
                              </td>
                              {visibleFields.map((fieldKey) => {
                                const f = (record.fields || []).find(
                                  (x) => x.field === fieldKey,
                                );
                                if (!f) {
                                  return (
                                    <td
                                      key={fieldKey}
                                      className='px-3 py-2 text-muted'
                                    >
                                      -
                                    </td>
                                  );
                                }
                                const checked =
                                  selections[record.model_name]?.has(
                                    fieldKey,
                                  ) || false;
                                return (
                                  <td key={fieldKey} className='px-3 py-2'>
                                    <label className='inline-flex cursor-pointer items-center gap-2'>
                                      <input
                                        type='checkbox'
                                        checked={checked}
                                        onChange={(event) =>
                                          toggleField(
                                            record.model_name,
                                            fieldKey,
                                            event.target.checked,
                                          )
                                        }
                                        className='h-3.5 w-3.5 accent-primary'
                                      />
                                      <HoverPanel
                                        placement='top'
                                        panelClassName='max-w-[480px]'
                                        content={
                                          <div className='space-y-2'>
                                            <div>
                                              <div className='text-[11px] uppercase text-muted'>
                                                {t('本地')}
                                              </div>
                                              <pre className='m-0 whitespace-pre-wrap text-xs text-foreground'>
                                                {formatValue(f.local)}
                                              </pre>
                                            </div>
                                            <div>
                                              <div className='text-[11px] uppercase text-muted'>
                                                {t('官方')}
                                              </div>
                                              <pre className='m-0 whitespace-pre-wrap text-xs text-foreground'>
                                                {formatValue(f.upstream)}
                                              </pre>
                                            </div>
                                          </div>
                                        }
                                      >
                                        <span className='inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-background px-2 py-0.5 text-xs text-foreground'>
                                          <MousePointerClick size={11} />
                                          {t('点击查看差异')}
                                        </span>
                                      </HoverPanel>
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Pager
                    current={currentPage}
                    pageSize={MODEL_TABLE_PAGE_SIZE}
                    total={filteredDataSource.length}
                    onChange={setCurrentPage}
                    t={t}
                  />
                </>
              )}
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='tertiary' onPress={onClose}>
                {t('取消')}
              </Button>
              <Button
                color='primary'
                onPress={handleOk}
                isPending={loading}
              >
                {t('应用覆盖')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default UpstreamConflictModal;
