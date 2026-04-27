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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
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
  Spinner,
  Tooltip,
  useOverlayState,
} from '@heroui/react';
import { ChevronDown, Info, Inbox, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getModelCategories } from '../../../../helpers/render';

// Mirrors the `HeaderCheckbox` pattern: an indeterminate state is set
// imperatively on the input element so the visual minus shows up
// between the checked / unchecked states.
function TriCheckbox({ checked, indeterminate, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type='checkbox'
      checked={!!checked}
      onChange={(event) => onChange?.(event.target.checked, event)}
      aria-label={ariaLabel}
      className='h-4 w-4 accent-primary'
      onClick={(event) => event.stopPropagation()}
    />
  );
}

// Replaces Semi `<Collapse>` / `<Collapse.Panel>` with a native
// `<details>` element. The summary keeps the header label + select-all
// extra slot from the original; the panel body is wrapped in a
// `border-t border-border` block so it visually splits when expanded.
function CategoryPanel({ title, extra, children }) {
  return (
    <details className='group rounded-2xl border border-border bg-background'>
      <summary className='flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground'>
        <ChevronDown
          size={16}
          className='shrink-0 text-muted transition-transform group-open:rotate-180'
        />
        <span className='flex-1'>{title}</span>
        {extra}
      </summary>
      <div className='border-t border-border px-4 py-3'>{children}</div>
    </details>
  );
}

const ModelSelectModal = ({
  visible,
  models = [],
  selected = [],
  redirectModels = [],
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  const getModelName = (model) => {
    if (!model) return '';
    if (typeof model === 'string') return model;
    if (typeof model === 'object' && model.model_name) return model.model_name;
    return String(model ?? '');
  };

  const normalizedSelected = useMemo(
    () => (selected || []).map(getModelName),
    [selected],
  );

  const [checkedList, setCheckedList] = useState(normalizedSelected);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('new');

  const isMobile = useIsMobile();
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const normalizeModelName = (model) =>
    typeof model === 'string' ? model.trim() : '';
  const normalizedRedirectModels = useMemo(
    () =>
      Array.from(
        new Set(
          (redirectModels || [])
            .map((model) => normalizeModelName(model))
            .filter(Boolean),
        ),
      ),
    [redirectModels],
  );
  const normalizedSelectedSet = useMemo(() => {
    const set = new Set();
    (selected || []).forEach((model) => {
      const normalized = normalizeModelName(model);
      if (normalized) {
        set.add(normalized);
      }
    });
    return set;
  }, [selected]);
  const classificationSet = useMemo(() => {
    const set = new Set(normalizedSelectedSet);
    normalizedRedirectModels.forEach((model) => set.add(model));
    return set;
  }, [normalizedSelectedSet, normalizedRedirectModels]);
  const redirectOnlySet = useMemo(() => {
    const set = new Set();
    normalizedRedirectModels.forEach((model) => {
      if (!normalizedSelectedSet.has(model)) {
        set.add(model);
      }
    });
    return set;
  }, [normalizedRedirectModels, normalizedSelectedSet]);

  const filteredModels = models.filter((m) =>
    String(m || '')
      .toLowerCase()
      .includes(keyword.toLowerCase()),
  );

  const isExistingModel = (model) =>
    classificationSet.has(normalizeModelName(model));
  const newModels = filteredModels.filter((model) => !isExistingModel(model));
  const existingModels = filteredModels.filter((model) =>
    isExistingModel(model),
  );

  // Sync external selection
  useEffect(() => {
    if (visible) {
      setCheckedList(normalizedSelected);
    }
  }, [visible, normalizedSelected]);

  // Default the active tab when the model list changes
  useEffect(() => {
    if (visible) {
      const hasNewModels = newModels.length > 0;
      setActiveTab(hasNewModels ? 'new' : 'existing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, newModels.length, selected]);

  const handleOk = () => {
    onConfirm && onConfirm(checkedList);
  };

  const categorizeModels = (modelList) => {
    const categories = getModelCategories(t);
    const categorizedModels = {};
    const uncategorizedModels = [];

    modelList.forEach((model) => {
      let foundCategory = false;
      for (const [key, category] of Object.entries(categories)) {
        if (key !== 'all' && category.filter({ model_name: model })) {
          if (!categorizedModels[key]) {
            categorizedModels[key] = {
              label: category.label,
              icon: category.icon,
              models: [],
            };
          }
          categorizedModels[key].models.push(model);
          foundCategory = true;
          break;
        }
      }
      if (!foundCategory) {
        uncategorizedModels.push(model);
      }
    });

    if (uncategorizedModels.length > 0) {
      categorizedModels['other'] = {
        label: t('其他'),
        icon: null,
        models: uncategorizedModels,
      };
    }

    return categorizedModels;
  };

  const newModelsByCategory = categorizeModels(newModels);
  const existingModelsByCategory = categorizeModels(existingModels);

  // Tab list — only shows tabs that have models in them.
  const tabList = [
    ...(newModels.length > 0
      ? [
          {
            label: `${t('新获取的模型')} (${newModels.length})`,
            key: 'new',
          },
        ]
      : []),
    ...(existingModels.length > 0
      ? [
          {
            label: `${t('已有的模型')} (${existingModels.length})`,
            key: 'existing',
          },
        ]
      : []),
  ];

  const handleCategorySelectAll = (categoryModels, isChecked) => {
    let newCheckedList = [...checkedList];
    if (isChecked) {
      categoryModels.forEach((model) => {
        if (!newCheckedList.includes(model)) {
          newCheckedList.push(model);
        }
      });
    } else {
      newCheckedList = newCheckedList.filter(
        (model) => !categoryModels.includes(model),
      );
    }
    setCheckedList(newCheckedList);
  };

  const isCategoryAllSelected = (categoryModels) =>
    categoryModels.length > 0 &&
    categoryModels.every((model) => checkedList.includes(model));

  const isCategoryIndeterminate = (categoryModels) => {
    const selectedCount = categoryModels.filter((model) =>
      checkedList.includes(model),
    ).length;
    return selectedCount > 0 && selectedCount < categoryModels.length;
  };

  const toggleSingle = (model) => {
    setCheckedList((prev) =>
      prev.includes(model)
        ? prev.filter((item) => item !== model)
        : [...prev, model],
    );
  };

  const renderModelsByCategory = (modelsByCategory) => {
    const categoryEntries = Object.entries(modelsByCategory);
    if (categoryEntries.length === 0) return null;

    return (
      <div className='space-y-3'>
        {categoryEntries.map(([key, categoryData]) => {
          const allSelected = isCategoryAllSelected(categoryData.models);
          const indeterminate = isCategoryIndeterminate(categoryData.models);
          const selectedInCategory = categoryData.models.filter((model) =>
            checkedList.includes(model),
          ).length;

          return (
            <CategoryPanel
              key={key}
              title={`${categoryData.label} (${categoryData.models.length})`}
              extra={
                <TriCheckbox
                  checked={allSelected}
                  indeterminate={indeterminate}
                  onChange={(checked) =>
                    handleCategorySelectAll(categoryData.models, checked)
                  }
                  ariaLabel={categoryData.label}
                />
              }
            >
              <div className='mb-3 flex items-center gap-2 text-xs text-muted'>
                {categoryData.icon}
                <span>
                  {t('已选择 {{selected}} / {{total}}', {
                    selected: selectedInCategory,
                    total: categoryData.models.length,
                  })}
                </span>
              </div>
              <div className='grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2'>
                {categoryData.models.map((model) => {
                  const checked = checkedList.includes(model);
                  return (
                    <label
                      key={model}
                      className='flex cursor-pointer items-center gap-2 text-sm text-foreground'
                    >
                      <input
                        type='checkbox'
                        checked={checked}
                        onChange={() => toggleSingle(model)}
                        className='h-4 w-4 accent-primary'
                      />
                      <span className='flex items-center gap-1.5'>
                        <span>{model}</span>
                        {redirectOnlySet.has(normalizeModelName(model)) && (
                          <Tooltip
                            content={t(
                              '来自模型重定向，尚未加入模型列表',
                            )}
                            placement='top'
                          >
                            <Info
                              size={14}
                              className='cursor-help text-warning'
                            />
                          </Tooltip>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </CategoryPanel>
          );
        })}
      </div>
    );
  };

  // Footer summary chip for the active tab
  const currentModels = activeTab === 'new' ? newModels : existingModels;
  const currentSelected = currentModels.filter((model) =>
    checkedList.includes(model),
  ).length;
  const isAllSelected =
    currentModels.length > 0 && currentSelected === currentModels.length;
  const isIndeterminate =
    currentSelected > 0 && currentSelected < currentModels.length;

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer
          size={isMobile ? 'full' : '2xl'}
          scroll='inside'
          placement='center'
        >
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <span className='text-base font-semibold text-foreground'>
                  {t('选择模型')}
                </span>
                {tabList.length > 0 ? (
                  <div className='inline-flex overflow-hidden rounded-lg border border-border'>
                    {tabList.map((tab) => {
                      const active = tab.key === activeTab;
                      return (
                        <button
                          key={tab.key}
                          type='button'
                          onClick={() => setActiveTab(tab.key)}
                          className={`px-3 py-1 text-xs font-medium transition-colors ${
                            active
                              ? 'bg-foreground text-background'
                              : 'bg-background text-muted hover:bg-surface-secondary'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </ModalHeader>
            <ModalBody className='max-h-[70vh] overflow-y-auto px-4 py-4 md:px-6'>
              <div className='flex flex-col gap-3'>
                <div className='relative'>
                  <Search
                    size={14}
                    className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted'
                  />
                  <Input
                    aria-label={t('搜索模型')}
                    placeholder={t('搜索模型')}
                    value={keyword}
                    onValueChange={setKeyword}
                    size='sm'
                    className='w-full [&_input]:pl-7'
                  />
                </div>

                {!models || models.length === 0 ? (
                  <div className='flex flex-col items-center justify-center gap-2 py-12'>
                    <Spinner color='primary' />
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className='flex flex-col items-center gap-3 py-10 text-center'>
                    <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                      <Inbox size={28} />
                    </div>
                    <span className='text-sm text-muted'>
                      {t('暂无匹配模型')}
                    </span>
                  </div>
                ) : (
                  <>
                    {activeTab === 'new' && newModels.length > 0 && (
                      <div>{renderModelsByCategory(newModelsByCategory)}</div>
                    )}
                    {activeTab === 'existing' && existingModels.length > 0 && (
                      <div>
                        {renderModelsByCategory(existingModelsByCategory)}
                      </div>
                    )}
                  </>
                )}

                {currentModels.length > 0 && (
                  <div className='flex items-center justify-end gap-2 pt-1 text-xs text-muted'>
                    <span>
                      {t('已选择 {{selected}} / {{total}}', {
                        selected: currentSelected,
                        total: currentModels.length,
                      })}
                    </span>
                    <TriCheckbox
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={(checked) =>
                        handleCategorySelectAll(currentModels, checked)
                      }
                      ariaLabel={t('全选')}
                    />
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='light' onPress={onCancel}>
                {t('取消')}
              </Button>
              <Button color='primary' onPress={handleOk}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ModelSelectModal;
