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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Inbox, Search } from 'lucide-react';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const normalizeModels = (models = []) =>
  Array.from(
    new Set(
      (models || []).map((model) => String(model || '').trim()).filter(Boolean),
    ),
  );

const filterByKeyword = (models = [], keyword = '') => {
  const normalizedKeyword = String(keyword || '')
    .trim()
    .toLowerCase();
  if (!normalizedKeyword) return models;
  return models.filter((model) =>
    String(model).toLowerCase().includes(normalizedKeyword),
  );
};

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

const ChannelUpstreamUpdateModal = ({
  visible,
  addModels = [],
  removeModels = [],
  preferredTab = 'add',
  confirmLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  const normalizedAddModels = useMemo(
    () => normalizeModels(addModels),
    [addModels],
  );
  const normalizedRemoveModels = useMemo(
    () => normalizeModels(removeModels),
    [removeModels],
  );

  const [selectedAddModels, setSelectedAddModels] = useState([]);
  const [selectedRemoveModels, setSelectedRemoveModels] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('add');
  const [partialSubmitConfirmed, setPartialSubmitConfirmed] = useState(false);
  const [partialConfirm, setPartialConfirm] = useState(null);

  const addTabEnabled = normalizedAddModels.length > 0;
  const removeTabEnabled = normalizedRemoveModels.length > 0;
  const filteredAddModels = useMemo(
    () => filterByKeyword(normalizedAddModels, keyword),
    [normalizedAddModels, keyword],
  );
  const filteredRemoveModels = useMemo(
    () => filterByKeyword(normalizedRemoveModels, keyword),
    [normalizedRemoveModels, keyword],
  );

  useEffect(() => {
    if (!visible) return;
    setSelectedAddModels([]);
    setSelectedRemoveModels([]);
    setKeyword('');
    setPartialSubmitConfirmed(false);
    const normalizedPreferredTab = preferredTab === 'remove' ? 'remove' : 'add';
    if (normalizedPreferredTab === 'remove' && removeTabEnabled) {
      setActiveTab('remove');
      return;
    }
    if (normalizedPreferredTab === 'add' && addTabEnabled) {
      setActiveTab('add');
      return;
    }
    setActiveTab(addTabEnabled ? 'add' : 'remove');
  }, [visible, addTabEnabled, removeTabEnabled, preferredTab]);

  const currentModels =
    activeTab === 'add' ? filteredAddModels : filteredRemoveModels;
  const currentSelectedModels =
    activeTab === 'add' ? selectedAddModels : selectedRemoveModels;
  const currentSetSelectedModels =
    activeTab === 'add' ? setSelectedAddModels : setSelectedRemoveModels;
  const selectedAddCount = selectedAddModels.length;
  const selectedRemoveCount = selectedRemoveModels.length;
  const checkedCount = currentModels.filter((model) =>
    currentSelectedModels.includes(model),
  ).length;
  const isAllChecked =
    currentModels.length > 0 && checkedCount === currentModels.length;
  const isIndeterminate =
    checkedCount > 0 && checkedCount < currentModels.length;

  const handleToggleAllCurrent = (checked) => {
    if (checked) {
      const merged = normalizeModels([
        ...currentSelectedModels,
        ...currentModels,
      ]);
      currentSetSelectedModels(merged);
      return;
    }
    const currentSet = new Set(currentModels);
    currentSetSelectedModels(
      currentSelectedModels.filter((model) => !currentSet.has(model)),
    );
  };

  const toggleModel = (model, checked) => {
    if (activeTab === 'add') {
      setSelectedAddModels((prev) =>
        checked
          ? Array.from(new Set([...prev, model]))
          : prev.filter((item) => item !== model),
      );
    } else {
      setSelectedRemoveModels((prev) =>
        checked
          ? Array.from(new Set([...prev, model]))
          : prev.filter((item) => item !== model),
      );
    }
  };

  const submitSelectedChanges = () => {
    onConfirm?.({
      addModels: selectedAddModels,
      removeModels: selectedRemoveModels,
    });
  };

  const handleSubmit = () => {
    const hasAnySelected = selectedAddCount > 0 || selectedRemoveCount > 0;
    if (!hasAnySelected) {
      submitSelectedChanges();
      return;
    }

    const hasBothPending = addTabEnabled && removeTabEnabled;
    const hasUnselectedAdd = addTabEnabled && selectedAddCount === 0;
    const hasUnselectedRemove = removeTabEnabled && selectedRemoveCount === 0;
    if (hasBothPending && (hasUnselectedAdd || hasUnselectedRemove)) {
      if (partialSubmitConfirmed) {
        submitSelectedChanges();
        return;
      }
      const missingTab = hasUnselectedAdd ? 'add' : 'remove';
      const missingType = hasUnselectedAdd ? t('新增') : t('删除');
      const missingCount = hasUnselectedAdd
        ? normalizedAddModels.length
        : normalizedRemoveModels.length;
      setActiveTab(missingTab);
      setPartialConfirm({
        type: missingType,
        count: missingCount,
      });
      return;
    }

    submitSelectedChanges();
  };

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const tabs = [
    {
      key: 'add',
      label: `${t('新增模型')} (${selectedAddCount}/${normalizedAddModels.length})`,
      disabled: !addTabEnabled,
    },
    {
      key: 'remove',
      label: `${t('删除模型')} (${selectedRemoveCount}/${normalizedRemoveModels.length})`,
      disabled: !removeTabEnabled,
    },
  ];

  return (
    <>
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='lg' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                {t('处理上游模型更新')}
              </ModalHeader>
              <ModalBody className='space-y-3 px-6 py-5'>
                <div className='text-xs text-muted'>
                  {t(
                    '可勾选需要执行的变更：新增会加入渠道模型列表，删除会从渠道模型列表移除。',
                  )}
                </div>

                <div role='tablist' className='flex items-center gap-2'>
                  {tabs.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        role='tab'
                        aria-selected={active}
                        type='button'
                        disabled={tab.disabled}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          active
                            ? 'border-transparent bg-foreground text-background shadow-sm'
                            : 'border-[color:var(--app-border)] bg-[color:var(--app-background)] text-foreground hover:bg-surface-secondary'
                        }`}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className='flex items-center gap-3 text-xs text-muted'>
                  <span>
                    {t('新增已选 {{selected}} / {{total}}', {
                      selected: selectedAddCount,
                      total: normalizedAddModels.length,
                    })}
                  </span>
                  <span>
                    {t('删除已选 {{selected}} / {{total}}', {
                      selected: selectedRemoveCount,
                      total: normalizedRemoveModels.length,
                    })}
                  </span>
                </div>

                <div className='relative'>
                  <Search
                    size={14}
                    className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                  />
                  <Input
                    type='text'
                    placeholder={t('搜索模型')}
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    aria-label={t('搜索模型')}
                    className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary'
                  />
                </div>

                <div className='max-h-80 overflow-y-auto pr-1'>
                  {currentModels.length === 0 ? (
                    <div className='flex flex-col items-center gap-3 py-10 text-center text-sm text-muted'>
                      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                        <Inbox size={28} />
                      </div>
                      <div>{t('暂无匹配模型')}</div>
                    </div>
                  ) : (
                    <div className='grid grid-cols-1 gap-x-4 md:grid-cols-2'>
                      {currentModels.map((model) => {
                        const checked = currentSelectedModels.includes(model);
                        return (
                          <label
                            key={`${activeTab}:${model}`}
                            className='my-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground transition hover:bg-[color:var(--app-background)]'
                          >
                            <input
                              type='checkbox'
                              checked={checked}
                              onChange={(event) =>
                                toggleModel(model, event.target.checked)
                              }
                              className='h-3.5 w-3.5 accent-primary'
                            />
                            <span className='min-w-0 truncate'>{model}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className='flex items-center justify-end gap-2'>
                  <span className='text-xs text-muted'>
                    {t('已选择 {{selected}} / {{total}}', {
                      selected: checkedCount,
                      total: currentModels.length,
                    })}
                  </span>
                  <HeaderCheckbox
                    checked={isAllChecked}
                    indeterminate={isIndeterminate}
                    onChange={handleToggleAllCurrent}
                    ariaLabel={t('全选当前列表模型')}
                  />
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button variant='light' onPress={onCancel}>
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={handleSubmit}
                  isPending={confirmLoading}
                >
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      <ConfirmDialog
        visible={!!partialConfirm}
        title={t('仍有未处理项')}
        cancelText={t('去处理{{type}}', {
          type: partialConfirm?.type || '',
        })}
        confirmText={t('仅提交已勾选')}
        onCancel={() => setPartialConfirm(null)}
        onConfirm={() => {
          setPartialConfirm(null);
          setPartialSubmitConfirmed(true);
          submitSelectedChanges();
        }}
      >
        {t(
          '你还没有处理{{type}}模型（{{count}}个）。是否仅提交当前已勾选内容？',
          {
            type: partialConfirm?.type || '',
            count: partialConfirm?.count || 0,
          },
        )}
      </ConfirmDialog>
    </>
  );
};

export default ChannelUpstreamUpdateModal;
